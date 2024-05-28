/**
 * @name SpyHandleMsg
 * @version 2.0.3
 * @author 小寒寒
 * @team 红灯区
 * @create_at 2033-10-27 11:12:09
 * @description 基于红灯区修改，适配可视化和V1、V2分享解析，当触发的消息中没有 export线报时,触发的消息会经过此模块解析
 * @module true
 * @public false
 * @authentication true
 * @classification ["模块"]
 * 修改于小寒寒脚本，删除新版本需要在web重新配置
 * 可以使用旧版本的解析方式填写在脚本当中
 */

const jsonSchema = BncrCreateSchema.object({
    jCommand: BncrCreateSchema.object({
        host: BncrCreateSchema.string().setTitle('反代').setDescription(`填写兔子的反代`).setDefault(""),
        token: BncrCreateSchema.string().setTitle('token').setDescription(`填写兔子的token`).setDefault("")
    }).setTitle('口令配置').setDescription(`用于解析口令，目前仅支持rabbit`).setDefault({})
});

const ConfigDB = new BncrPluginConfig(jsonSchema);

const wx100shareParse = require('../../hh_bncr_plugins/mod/wx100shareParse');
const axios = require('axios');

module.exports = async msg => {

    if (!Object.keys(ConfigDB.userConfig).length) {
        console.log('请先发送"修改无界配置",或者前往前端web"插件配置"来完成插件首次配置');
        return '';
    }

    const urlReg = /https:\/\/[A-Za-z0-9\-\._~:\/\?#\[\]!$&'\*\+,%;\=]*/g;
    const codeReg = /[(|)|#|@|$|%|¥|￥|!|！][0-9a-zA-Z]{10,14}[(|)|#|@|$|%|¥|￥|!|！]/g;
    const urlArr = msg.match(urlReg)?.map(url => decodeURIComponent(url)) ?? [];
    const codeArr = msg.match(codeReg) ?? [];
    for (const [i, code] of codeArr.entries()) {
        const res = await jCommand(code);
        res ? (codeArr[i] = res) : codeArr.slice(i, 1);
    }
    let result = '';
    for (let link of [...urlArr, ...codeArr]) {
        let newLink = '';
        if (/\?(shareId|shareKey)=[0-9a-zA-Z]+/.test(link)) {
            newLink = await wx100shareParse(link);
            link = newLink ? newLink : link;
        } else if (/gzsl-isv\.isvjcloud\.com\/wuxian\/user\//.test(link)) {
            try {
                let response = await axios.get(link, { maxRedirects: 0 });
                newLink = response.headers.location;
            } catch (error) {
                newLink = error.response.headers.location;
            }
            link = newLink ? newLink.split('url=')[1] : link;
        }
        urlToExport(link)?.forEach(e => (result += `export ${e.name}="${e.value}"\n`));
    }
    return result ? `外部模块解析结果:\n${result}` : '';
};

function ListS() {
    return [
      // 这里可以添加更多的配置项
	     {
			keyword: /cjhy(dz)?-isv\.isvjcloud\.com\/microDz\/invite\/activity/,
			name: "CJ微定制",
			trans: [{
				ori: "activityId",
				redi: "jd_wdz_activityId"
			}]
		},
		// 这里可以添加更多的配置项
       
    ];
}

/* 口令解析接口 */
async function jCommand(code) {
    try {
        const option = {
            method: 'POST',
            url: `${ConfigDB.userConfig.jCommand.host || ''}/api/command`,
            headers: {},
            data: {
                'code': decodeURIComponent(code),
                'token': ConfigDB.userConfig.jCommand.token || ''
            },
            json: true
        }
        let { data } = await axios(option);
        return data?.data?.jumpUrl;
    } catch (e) {
        console.log('jCommand ' + e);
        return void 0;
    }
}

/* 解析函数 ,改于白眼 */
function urlToExport(url) {
    let ResArr = [];
    const listS = ListS();
    for (const oneList of listS) {
        if (!url.match(oneList.keyword)) continue;
        for (const r of oneList.trans) {
            let temp = {
                act: oneList.name,
                name: r.redi,
            };
            if (+r.ori === -1) {
                temp['value'] = encodeURI(url);
            } else if (r.ori.indexOf(' ') !== -1) {
                //提取多参数作为变量值
                let pn = r.ori.split(' ');
                let pv = [];
                pn.forEach(ele => {
                    if (!ele) return;
                    let reg = new RegExp('(?<=' + ele + '(=|%3D))[^&%]+'),
                        actid = url.match(reg);
                    if (actid) pv.push(actid[0]);
                    else console.log(url + '\n中未找到活动参数:' + ele);
                });
                if (!pv.length) break;
                if (r.sep) temp['value'] = pv.join(r.sep);
                else console.log('内置解析规则' + JSON.stringify(oneList) + '缺少分割符');
            } else {
                // 提取参数作为变量
                let reg = new RegExp(`(?<=${r.ori}(=|%3D))[^&%]+`),
                    actid = url.match(reg);
                if (!actid) break;
                temp['value'] = actid[0];
            }
            temp['value'] && ResArr.push(temp);
        }
    }
    return ResArr;
}