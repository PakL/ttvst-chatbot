const app = require('electron').remote.app
const VarInterface = require('./VarInterface')
const dateFormat = require(app.getAppPath() + '/node_modules/dateformat')

let _i18n = null
let timestamp = function(ts, date, time){
	var d = new Date()
	if(typeof(ts) != 'undefined')
		d = new Date(ts)

	if(typeof(date) != 'boolean')
		date = false
	if(typeof(time) != 'boolean')
		time = false
	
	if(!date && !time) {
		date = true
		time = true
	}

	return dateFormat(d, (date ? _i18n.__('mm.dd.yyyy') : '') + (date && time ? ' ' : '') + (time ? _i18n.__('hh:MMtt') : ''))
}

class VarContext extends VarInterface {

	constructor(name, msg) {
		super(name)

		if(_i18n === null) {
			_i18n = Tool.addons.getAddon('Bot').i18n
		}
		switch(name) {
			case 'game':
				this.value = (Tool.channel.streamobject !== null && typeof(Tool.channel.streamobject.gamename) === 'string' ? Tool.channel.streamobject.gamename : '')
				break
			case 'sender':
				this.value = msg.user.name
				break
			case 'date':
				this.value = timestamp(msg.tags['sent-ts'], true, false)
				break
			case 'time':
				this.value = timestamp(msg.tags['sent-ts'], false, true)
				break
			case 'datetime':
				this.value = timestamp(msg.tags['sent-ts'], true, true)
				break
		}
	}

	setTo(value, index) {}

} 
module.exports = VarContext