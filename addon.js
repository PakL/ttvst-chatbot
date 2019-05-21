const UIPage  = require(path.dirname(module.parent.filename) + '/../mod/uipage')

const VarInterface = require('./modules/VarInterface')
const VarArgument = require('./modules/VarArgument')
const VarStorage = require('./modules/VarStorage')
const VarContext = require('./modules/VarContext')

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
		this.lastCommandExecution = {}

		this.lastTimerMinute = -1
		this.hasTimerCmds = false
		this.hasFollowerCmds = false
		this.hasSubscriberCmds = false
		this.hasHostCmds = false
		this.hasWebsocketCmds = false


		// Executing this event listener asynchronous will prevent blocking the message from showing (esp. on errors)
		this.onChatmessageListener = async (chn, ts, usr, msg_html, msg, type, uuid) => {
			if(chn.toLowerCase() != self.auth.username.toLowerCase()) return
			if([0, 5].indexOf(type) < 0) return

			self.onMessage(usr, {'chn': chn, 'usr': usr, 'msg': msg, 'uuid': uuid})
		}
		this.onSendmessageListener = (event) => {
			if(event.messageobj.channel.toLowerCase() != self.auth.username.toLowerCase()) return

			try {
				if(self.onMessage(event.messageobj.user, {'chn': event.messageobj.channel, 'usr': event.messageobj.user, 'msg': event.messageobj.message, 'uuid': null})) {
					event.prevent = true
				}
			} catch(e) {
				console.error(e)
			}
		}
		this.onTimerListener = null
		this.onFollowListener = async (usr, f) => { self.onFollow(usr, f) }
		this.onSubscriberListener = async (chn, usr, tags, msg) => { self.onSubscriber(chn, usr, tags, msg) }
		this.onHostListener = async (chn, usr, viewers, msg, tags) => { self.onHost(chn, usr, viewers, msg, tags) }
		this.onWebsocketListener = async (command) => { self.onWebsocket(command) }

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

			self.tool.cockpit.on('channelopen', () => {
				this.hookEventlistener()
			})
			self.tool.cockpit.on('channelleft', () => {
				this.removeEventListener()
			})
		})
	}

	setCommands(commands) {
		this.commands = commands
		this.lastCommandExecution = {}

		this.hasTimerCmds = false
		this.hasFollowerCmds = false
		this.hasSubscriberCmds = false
		this.hasHostCmds = false
		this.hasWebsocketCmds = false
		for(let i = 0; i < this.commands.length; i++) {
			let c = this.commands[i].cmd.toLowerCase()

			if(c.startsWith('/timer')) {
				this.hasTimerCmds = true;
			} else if(c.startsWith('/follow')) {
				this.hasFollowerCmds = true;
			} else if(c.startsWith('/sub')) {
				this.hasSubscriberCmds = true;
			} else if(c.startsWith('/host')) {
				this.hasHostCmds = true;
			} else if(c.startsWith('/cmd ')) {
				this.hasWebsocketCmds = true;
			}
		}

		this.removeEventListener()
		this.hookEventlistener()
	}

	hookEventlistener() {
		if(!this.tool.cockpit.openChannelObject.hasOwnProperty('login') || this.tool.cockpit.openChannelObject.login.toLowerCase() != this.auth.username.toLowerCase()) return
		console.log('[chatbot] Creating event listener')
		this.chat.on('chatmessage', this.onChatmessageListener)
		this.chat.on('sendmessage', this.onSendmessageListener)

		if(this.hasTimerCmds) {
			this.lastTimerMinute = -1
			const self = this
			this.onTimerListener = setTimeout(() => {
				this.lastTimerMinute = new Date().getMinutes()
				self.onTimerListener = setInterval(async () => {
					this.lastTimerMinute = new Date().getMinutes()
					// TODO: Execute event
				}, 60000)
			}, 60000 - (new Date().getTime() % 60000))
		}
		if(this.hasFollowerCmds) this.tool.follows.on('follow', this.onFollowListener)
		if(this.hasSubscriberCmds) this.chat.on('usernotice', this.onSubscriberListener)
		if(this.hasHostCmds) {
			this.chat.on('hostingyou', this.onHostListener)
			this.chat.on('autohostingyou', this.onHostListener)
		}
		if(this.hasWebsocketCmds) this.tool.overlays.on('command', this.onWebsocketListener)
	}

	removeEventListener() {
		console.log('[chatbot] Removing all listener')
		this.chat.removeListener('chatmessage', this.onChatmessageListener)
		this.chat.removeListener('sendmessage', this.onSendmessageListener)

		if(this.onTimerListener !== null) {
			if(this.lastTimerMinute >= 0)
				clearInterval(this.onTimerListener)
			else
				clearTimeout(this.onTimerListener)
			this.onTimerListener = null
		}
		this.lastTimerMinute = -1

		this.tool.follows.removeListener('follow', this.onFollowListener)
		this.chat.removeListener('usernotice', this.onSubscriberListener)
		this.chat.removeListener('hostingyou', this.onHostListener)
		this.chat.removeListener('autohostingyou', this.onHostListener)
		this.tool.overlays.removeListener('command', this.onWebsocketListener)
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
			if(message != this.commands[i].cmd && !message.startsWith(this.commands[i].cmd + ' ')) continue
			if(typeof(this.lastCommandExecution[this.commands[i].id.toString()]) === 'number' && this.lastCommandExecution[this.commands[i].id.toString()] > new Date().getTime() - (this.commands[i].timeout * 1000)) continue
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

	executeCommand(msg, cmd, args) {
		console.log('[chatbot] command ' + cmd.cmd + ' is being executed')
		this.lastCommandExecution[cmd.id.toString()] = new Date().getTime()
		let response = cmd.response
		if(Bot.hasStatement(response)) {
			if(typeof(args) === 'undefined') args = this.messageToArgs(msg.msg)
			console.log('[chatbot] processing ' + response)
			response = this.processStatements(response, args, msg)
		}
		response = response.replace('\n', ' ')
		response = response.replace('\r', '')
		response = response.trim()
		if(response.length > 0) {
			this.chat.sendmsg(this.auth.username, response, this.tool.cockpit.emoticons_data)
			console.log('[chatbot] ' + response)
		}
	}

	onMessage(user, msg) {
		let message = msg.msg
		let commands = this.filterCommands(message, user)
		if(commands.length > 0) {
			let args = this.messageToArgs(message)
			for(let i = 0; i < commands.length; i++) {
				let cmd = commands[i]
				this.executeCommand(msg, cmd, args)
			}
			return true
		}
		return false
	}

	async onTimer() {
		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.cmd.toLowerCase().startsWith('/timer')) continue
			let timeoutFix = Math.floor(cmd.timeout / 60)
			if(timeoutFix <= 0 || timeoutFix > 59) timeoutFix = 59
			if(new Date().getMinutes() % timeoutFix > 0) continue

			this.executeCommand({'chn': this.tool.cockpit.openChannelObject.login, 'msg': cmd.cmd, 'uuid': null}, cmd)
		}
	}

	onFollow(usr, f) {
		let nowDate = new Date().getTime()
		let followDate = new Date(f.followed_at).getTime()
		if(nowDate-process.uptime() > followDate) return // Follow is older than the application is running?

		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.cmd.toLowerCase().startsWith('/follow')) continue

			this.executeCommand({'chn': this.tool.cockpit.openChannelObject.login, 'usr': usr, 'msg': cmd.cmd, 'uuid': null}, cmd)
		}
	}

	onSubscriber(chn, usr, tags, msg) {
		if(chn.toLowerCase() != this.auth.username.toLowerCase()) return
		if(['sub', 'resub', 'subgift', 'anonsubgift'].indexOf(tags['msg-id']) < 0) return

		if(['subgift', 'anonsubgift'].indexOf(tags['msg-id']) >= 0) {
			usr = {
				user: tags['msg-param-recipient-user-name'],
				name: tags['msg-param-recipient-display-name'],
				color: this.chat.userselement._tag.getUserColor(tags['msg-param-recipient-user-name'])
			}
		}

		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.cmd.toLowerCase().startsWith('/sub')) continue

			let cmdargs = cmd.cmd.substr(4).trim()
			let msg = '/sub ' + (typeof(tags['msg-param-cumulative-months']) === 'undefined' ? (typeof(tags['msg-param-months']) === 'undefined' ? '1' : tags['msg-param-months']) : tags['msg-param-cumulative-months']) + (cmdargs.length > 0 ? ' ' + cmdargs : '')
			this.executeCommand({'chn': chn, 'usr': usr, 'msg': msg, 'uuid': null}, cmd)
		}
	}

	onHost(chn, usr, viewers, msg, tags) {
		if(chn.toLowerCase() != this.auth.username.toLowerCase()) return

		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.cmd.toLowerCase().startsWith('/host')) continue

			let cmdargs = cmd.cmd.substr(5).trim()
			let msg = '/host ' + viewers + (cmdargs.length > 0 ? ' ' + cmdargs : '')
			this.executeCommand({'chn': chn, 'usr': usr, 'msg': msg, 'uuid': null}, cmd)
		}
	}

	onWebsocket(command) {
		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.cmd.toLowerCase().startsWith('/cmd ')) continue
			if(cmd.cmd.substr(5).trim() != command.trim()) continue

			this.executeCommand({'chn': this.auth.username.toLowerCase(), 'msg': cmd.cmd, 'uuid': null}, cmd)
		}
	}

	static hasStatement(message){
		if(message.match(/\{(% |\{)(.*?)( %|\})\}/s)) {
			return true
		}
		return false
	}


	/**
	 * @param {string} expression 
	 * @param {string[]} args 
	 * @param {object} msg 
	 * @returns {VarInterface}
	 */
	getVarInterface(expression, args, msg) {
		let matches = expression.match(/^(%[0-9]+|\/[a-z]+|\$[a-z0-9]+)(\[.+\])?$/i)
		if(matches !== null) {
			if(matches[1].match(/^%[0-9]+$/)) {
				let argIndex = parseInt(expression.substr(1))
				if(args.length > argIndex) {
					return new VarArgument(args[argIndex])
				} else {
					return null
				}
			} else if(matches[1].match(/^\/[a-z]+$/i)) {
				return new VarContext(matches[1].substr(1).toLowerCase(), msg)
			} else if(matches[1].match(/^\$[a-z0-9]+$/i)) {
				return new VarStorage(matches[1].substr(1))
			}
		} else {
			return new VarArgument(expression)
		}
	}

	/**
	 * @param {string} expression 
	 * @param {string[]} args 
	 * @param {object} msg 
	 * @returns {string|number}
	 */
	getVarIndex(expression, args, msg) {
		let matches = expression.match(/^(%[0-9]+|\/[a-z]+|\$[a-z0-9]+)(\[.+\])?$/i)
		if(matches !== null && typeof(matches[2]) !== 'undefined') {
			let indexStr = matches[2].substr(1, matches[2].length-2)
			let interf = this.getVarInterface(indexStr, args, msg)
			let interfaceIndex = this.getVarIndex(indexStr, args, msg)
			if(interf === null) {
				return null
			}

			return interf.getValue(interfaceIndex)
		}

		return null
	}

	processStatements(response, args, msg) {
		let stmtRegex = /\{% (.*?) %\}/gs
		let match = null
		let responseResult = ''
		let lastIndex = 0
		while(match = stmtRegex.exec(response)) {
			responseResult += response.substr(lastIndex, (match.index - lastIndex))
			lastIndex = match.index+match[0].length

			let stmtArgs = this.messageToArgs(match[1])
			if(stmtArgs.length > 0) {
				if(stmtArgs[0].toLowerCase() == 'set' && stmtArgs.length >= 4) {
					this.processStmtSet(stmtArgs, args, msg)
				} else if(stmtArgs[0].toLowerCase() == 'add' && stmtArgs.length >= 4) {
					this.processStmtAdd(stmtArgs, args, msg)
				} else if(stmtArgs[0].toLowerCase() == 'print' && stmtArgs.length >= 2) {
					responseResult += this.processStmtPrint(stmtArgs, args, msg)
				}
			}
		}
		responseResult += response.substr(lastIndex)

		response = responseResult
		stmtRegex = /\{\{(.*?)\}\}/gs
		match = null
		responseResult = ''
		lastIndex = 0
		while(match = stmtRegex.exec(response)) {
			responseResult += response.substr(lastIndex, (match.index - lastIndex))
			lastIndex = match.index+match[0].length

			let stmtArgs = this.messageToArgs(match[1].trim())
			if(stmtArgs.length > 0) {
				stmtArgs.unshift('print')
				responseResult += this.processStmtPrint(stmtArgs, args, msg)
			}
		}
		responseResult += response.substr(lastIndex)

		return responseResult
	}

	processStmtSet(stmt, args, msg) {
		let var1 = this.getVarInterface(stmt[1], args, msg)
		let var1Index = this.getVarIndex(stmt[1], args, msg)
		let var2 = this.getVarInterface(stmt[3], args, msg)
		let var2Index = this.getVarIndex(stmt[3], args, msg)

		if(var1 === null || var2 === null) return
		if(['into', '>', '->'].indexOf(stmt[2]) >= 0) {
			var2.setTo(var1.getValue(var1Index), var2Index)
		} else if(['<', '<-'].indexOf(stmt[2]) >= 0) {
			var1.setTo(var2.getValue(var2Index), var1Index)
		}
	}

	processStmtAdd(stmt, args, msg) {
		let var1 = this.getVarInterface(stmt[1], args, msg)
		let var1Index = this.getVarIndex(stmt[1], args, msg)
		let var2 = this.getVarInterface(stmt[3], args, msg)
		let var2Index = this.getVarIndex(stmt[3], args, msg)

		if(var1 === null || var2 === null) return
		if(['>', '->', 'to'].indexOf(stmt[2]) >= 0) {
			var2.addTo(var1.getValue(var1Index), var2Index)
		} else if(['<', '<-'].indexOf(stmt[2]) >= 0) {
			var1.addTo(var2.getValue(var2Index), var1Index)
		}
	}

	processStmtPrint(stmt, args, msg) {
		let var1 = this.getVarInterface(stmt[1], args, msg)
		let var1Index = this.getVarIndex(stmt[1], args, msg)

		if(var1 === null) return ''
		let value = var1.getValue(var1Index)
		if(typeof(value) === 'string' || typeof(value) === 'number')
			return value.toString()

		return ''
	}

}

module.exports = Bot