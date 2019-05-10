const app = require('electron').remote.app
const VarInterface = require('./VarInterface')
const dateFormat = require(app.getAppPath() + '/node_modules/dateformat')

let _i18n = null
let timestamp = function(ts, date, time){
	var d = new Date()
	if(typeof(ts) !== 'undefined' && ts !== null)
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
			_i18n = Tool.addons.getAddon('chatbot').i18n
		}
		switch(name) {
			case 'game':
				this.value = (Tool.channel.streamobject !== null && typeof(Tool.channel.streamobject.gamename) === 'string' ? Tool.channel.streamobject.gamename :
								(Tool.channel.channelobject !== null  && typeof(Tool.channel.channelobject.game) === 'string' ? Tool.channel.channelobject.game : ''))
				break
			case 'sender':
				if(typeof(msg) === 'object' && typeof(msg.usr) === 'object' && typeof(msg.usr.name) === 'string')
					this.value = msg.usr.name
				break
			case 'msg-uid':
				if(typeof(msg) === 'object' && typeof(msg.uuid) === 'string')
					this.value = msg.uuid
				break
			case 'date':
				this.value = timestamp(null, true, false)
				break
			case 'time':
				this.value = timestamp(null, false, true)
				break
			case 'datetime':
				this.value = timestamp(null, true, true)
				break
			case 'random':
				this.value = Math.random()
				break
		}
	}

	setTo(value, index) {}

	addTo(value, index) {}

} 
module.exports = VarContext