'use strict'

const UIPage  = require(path.dirname(module.parent.filename) + '/../mod/uipage')

class Bot extends UIPage {

	constructor(tool, i18n) {
		super('Bot')
		const self = this

		this.tool = tool
		this.chat = this.tool.chat
		this.auth = this.tool.auth
		this.settings = this.tool.settings
		this.i18n = i18n

		this.commands = []
		this.lastCommandExecution = []
		
		this.chat.on('chatmessage', (chn, ts, usr, msg_html, msg, type, uuid) => {
			if(chn.toLowerCase() != self.auth.username.toLowerCase()) return
			if([0, 5].indexOf(type) < 0) return

			self.onMessage(usr, msg)
		})

		this.tool.on('load', () => {
			self.contentElement = document.createElement('div')
			self.contentElement.setAttribute('id', 'content_bot')
			document.querySelector('#contents').appendChild(self.contentElement)

			let botcommandsScriptElement = document.createElement('script')
			botcommandsScriptElement.setAttribute('type', 'application/javascript')
			botcommandsScriptElement.setAttribute('src', '/' + __dirname.replace(/\\/g, '/') + '/res/botcommands.js')
			botcommandsScriptElement.addEventListener('load', () => {
				self.commandListElement = document.createElement('botcommands')
				self.commandListElement.setAttribute('id', 'bot_commands')
				self.contentElement.appendChild(self.commandListElement)

				riot.mount(self.commandListElement, {i18n: i18n, addonDirname: __dirname})
			})
			document.querySelector('body').appendChild(botcommandsScriptElement)
		})
	}

	setCommands(commands) {
		this.commands = commands
		//console.log(this.commands)
	}

	get icon() {
		return '🤖'
	}

	open() {
		this.contentElement.style.display = 'block'
	}

	close() {
		this.contentElement.style.display = 'none'
	}

	getPermissionLevels(badges) {
		let levels = ['everybody']
		if(badges.indexOf('Subscriber') >= 0) levels = ['everybody', 'subscribers']
		if(badges.indexOf('VIP') >= 0) levels = ['everybody', 'subscribers', 'vip']
		if(badges.indexOf('Moderator') >= 0) levels = ['everybody', 'subscribers', 'vip', 'moderators']
		if(badges.indexOf('Broadcaster') >= 0) levels = ['everybody', 'subscribers', 'vip', 'moderators', 'broadcaster']
		return levels
	}

	filterCommands(message, user) {
		let permLevels = this.getPermissionLevels(user['badges'])
		let filteredCmds = []
		for(let i = 0; i < this.commands.length; i++) {
			if(!message.startsWith(this.commands[i].cmd)) continue
			if(typeof(this.lastCommandExecution[this.commands[i].cmd]) === 'number' && this.lastCommandExecution[this.commands[i].cmd] > new Date().getTime() - (this.commands[i].timeout * 1000)) continue
			if(permLevels.indexOf(this.commands[i].permission) < 0) continue

			filteredCmds.push(this.commands[i])
		}
		return filteredCmds
	}

	messageToArgs(message) {
		let args = []
		let argsRegex = /("(.*?)"( |$)|[^ ]+)/gu
		let match = null
		while(match = argsRegex.exec(message)) {
			if(typeof(match[2]) === 'string')
				args.push(match[2])
			else
				args.push(match[1])
		}
		return args
	}

	onMessage(user, message) {
		let commands = this.filterCommands(message, user)
		if(commands.length > 0) {
			let args = null
			
			for(let i = 0; i < commands.length; i++) {
				let cmd = commands[i]
				let response = cmd.response
				if(Bot.hasStatement(response)) {
					if(args === null) args = this.messageToArgs(message)
					response = this.processStatements(response, args)
				}
				this.tool.chat.sendmsg(this.auth.username, response, this.tool.cockpit.emoticons_data)
			}
		}
	}

	static hasStatement(message){
		if(message.match(/\{% (.*?) %\}/s)) {
			return true
		}
		return false
	}

	processStatements(response, args) {
		let stmtRegex = /\{% (.*?) %\}/gs
		let match = null
		let responseResult = ''
		let lastIndex = 0
		while(match = stmtRegex.exec(response)) {
			responseResult = response.substr(lastIndex, (lastIndex - match.index))
			lastIndex = match.index+match[0].length

			let stmtArgs = this.messageToArgs(match[1])
			if(stmtArgs.length > 0) {
				if(stmtArgs[0].toLowerCase() == 'set' && stmtArgs.length > 4) {

				}
			}
		}
		responseResult = response.substr(lastIndex)
		return responseResult
	}

	processStmtSet(stmt, args) {
		
	}

}

module.exports = Bot