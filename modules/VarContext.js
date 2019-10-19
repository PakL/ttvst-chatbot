const app = require('electron').remote.app
const VarInterface = require('./VarInterface')
const dateFormat = require(app.getAppPath() + '/node_modules/dateformat')

let _addon = null
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

let _contextRegister = {}

class VarContext extends VarInterface {

	constructor(name, msg) {
		super(name)

		if(_addon === null) {
			_addon = Tool.addons.getAddon('chatbot')
		}
		if(_i18n === null) {
			_i18n = _addon.i18n
		}

		if(typeof(_contextRegister[name]) === 'function') {
			this.value = _contextRegister[name](msg)
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
			case 'senderlogin':
				if(typeof(msg) === 'object' && typeof(msg.usr) === 'object' && typeof(msg.usr.user) === 'string')
					this.value = msg.usr.user
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
			case 'points':
				this.value = _addon.points
				break
			case 'ranks':
				this.value = require('../CommandExecution').getPermissionLevels(msg.usr.badges)
				break
		}
	}

	static registerContext(name, callback) {
		if(typeof(name) === 'string' && typeof(callback) === 'function') {
			_contextRegister[name] = callback
			console.log('[chatbot] registered context ' + name)
		}
	}

	async getValue(index) {
		if(this.name == 'points') index = index.toLowerCase()
		let val = await super.getValue(index)
		if(this.name != 'points') return val
		if(index == Tool.auth.username.toLowerCase()) return Number.MAX_SAFE_INTEGER
		if(val === null) return 0
		return val
	}

	setTo(value, index) {
		const self = this
		return new Promise((y, n) => {
			if(self.name == 'points') {
				if(typeof(value) === 'number' || (typeof(value) === 'string' && value.match(/^-?([0-9]+)(\.([0-9]+))?$/))) {
					value = parseFloat(value)
					index = index.toLowerCase()
					_addon.setPoints(index, value)
				}
				y()
			} else {
				y()
			}
		})
	}

	addTo(value, index) {
		const self = this
		return new Promise((y, n) => {
			if(self.name == 'points') {
				if(typeof(value) === 'string' && value.match(/^-?([0-9]+)(\.([0-9]+))?$/)) {
					value = parseFloat(value)
				}
				if(typeof(value) === 'number') {
					index = index.toLowerCase()
					_addon.addPoints(index, value)
				}
				y()
			} else {
				y()
			}
		})
	}

} 
module.exports = VarContext