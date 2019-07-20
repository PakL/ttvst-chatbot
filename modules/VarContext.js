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

let timesince = function(ts){
	let seconds = Math.floor((new Date().getTime() - ts) / 1000)
	let minutes = Math.floor(seconds / 60); seconds -= (minutes * 60)
	let hours = Math.floor(minutes / 60); minutes -= (hours * 60)

	return _i18n.__('{{hours}} {{hours||hours}} {{minutes}} {{minutes||minutes}} {{seconds}} {{seconds||seconds}}', {'hours': hours, 'minutes': minutes, 'seconds': seconds})
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
			case 'uptime':
				let ts = new Date().getTime()
				if(Tool.channel.streamobject !== null && typeof(Tool.channel.streamobject.started_at) === 'string') {
					ts = new Date(Tool.channel.streamobject.started_at).getTime()
				}
				this.value = timesince(ts)
				break
			case 'random':
				this.value = Math.random()
				break
		}
	}

	setTo(value, index) { return new Promise((y, n) => { y() }) }

	addTo(value, index) { return new Promise((y, n) => { y() }) }

} 
module.exports = VarContext