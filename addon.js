const UIPage  = require(path.dirname(module.parent.filename) + '/../mod/uipage')
const TMI = require(path.dirname(module.parent.filename) + '/../lib/twitchchat')
const Helix = require(path.dirname(module.parent.filename) + '/../lib/twitchhelix')
const TwitchAuth = require(path.dirname(module.parent.filename) + '/../mod/auth')
const fs = require('fs')

const { BrowserWindow } = require('electron').remote

const VarInterface = require('./modules/VarInterface')
const VarArgument = require('./modules/VarArgument')
const VarStorage = require('./modules/VarStorage')
const VarContext = require('./modules/VarContext')
const VarRequest = require('./modules/VarRequest')
const VarFile = require('./modules/VarFile')

const Sync = require('./sync')

class Bot extends UIPage {

	constructor(tool, i18n) {
		super('Bot')
		const self = this

		this.tool = tool
		this.chat = this.tool.chat
		this.auth = this.tool.auth
		this.settings = this.tool.settings
		this.i18n = i18n

		this.settings.cloudDontSync.push('chatbot_token')
		this.settings.cloudDontSync.push('chatbot_points')

		this.alttmi = null

		this.commands = []
		this.lastCommandExecution = {}

		this.points = this.settings.getJSON('chatbot_points', {})
		this.pointsSettings = this.settings.getJSON('chatbot_points_settings', { active: false, ppm: 10, submult: 1, vipmult: 1, modmult: 1 })
		this.pointsTimerTimeout = null
		this.pointsOnTimerListener = null

		this.timerTimeout = null
		this.hasTimerCmds = false
		this.timerCmds = []
		this.hasFollowerCmds = false
		this.hasSubscriberCmds = false
		this.hasHostCmds = false
		this.hasWebsocketCmds = false

		this.sync = new Sync(this)

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

		let botcommandsTag = fs.readFileSync(__dirname.replace(/\\/g, '/') + '/res/botcommands.riot', { encoding: 'utf8' })
		let bcCode = riot.compileFromString(botcommandsTag).code
		riot.inject(bcCode, 'botcommands', document.location.href)
		let botvariablesTag = fs.readFileSync(__dirname.replace(/\\/g, '/') + '/res/botvariables.riot', { encoding: 'utf8' })
		let bvCode = riot.compileFromString(botvariablesTag).code
		riot.inject(bvCode, 'botvariables', document.location.href)

		this.contentElement = document.createElement('div')
		this.contentElement.setAttribute('id', 'content_bot')
		this.vareditElement = document.createElement('div')
		this.vareditElement.setAttribute('id', 'content_bot_varedit')
		document.querySelector('#contents').appendChild(this.contentElement)
		document.querySelector('#contents').appendChild(this.vareditElement)

		let vareditViewToggle = document.createElement('button')
		vareditViewToggle.innerText = '🛡️ ' + i18n.__('Go to variable editor')
		vareditViewToggle.addEventListener('click', () => { self.toggleVarEditView() })
		vareditViewToggle.style.margin = '10px'
		this.contentElement.appendChild(vareditViewToggle)

		this.altAccountLoginBtn = document.createElement('button')
		this.altAccountLoginBtn.innerHTML = '<span class="icon icon-twitch"></span> ' + (this.altAccountLoginToken.length > 0 ? i18n.__('Logout alternate account') : i18n.__('Use alternate account to post responses'))
		this.altAccountLoginBtn.addEventListener('click', () => { self.altAccountLogin() })
		this.altAccountLoginBtn.style.margin = '10px'
		this.contentElement.appendChild(this.altAccountLoginBtn)

		let pointSettingsBtn = document.createElement('button')
		pointSettingsBtn.innerHTML = '💰 ' +  i18n.__('Points system settings')
		pointSettingsBtn.addEventListener('click', () => { self.openPointSettings() })
		pointSettingsBtn.style.margin = '10px'
		this.contentElement.appendChild(pointSettingsBtn)

		vareditViewToggle = document.createElement('button')
		vareditViewToggle.innerText = '⚔️ ' + i18n.__('Back to command editor')
		vareditViewToggle.addEventListener('click', () => { self.toggleVarEditView() })
		vareditViewToggle.style.margin = '10px'
		this.vareditElement.appendChild(vareditViewToggle)

		this.commandListElement = document.createElement('botcommands')
		this.commandListElement.setAttribute('id', 'bot_commands')
		this.contentElement.appendChild(this.commandListElement)
		riot.mount(this.commandListElement, {i18n: i18n, addonDirname: __dirname, addon: this})

		this.variablesListElement = document.createElement('botvariables')
		this.variablesListElement.setAttribute('id', 'bot_variables')
		this.vareditElement.appendChild(this.variablesListElement)
		riot.mount(this.variablesListElement, {i18n: i18n, addonDirname: __dirname, addon: this})

		this.tool.cockpit.on('channelopen', () => {
			this.hookEventlistener()
		})
		this.tool.cockpit.on('channelleft', () => {
			this.removeEventListener()
		})
	}

	getAppIconPath() {
		return path.normalize(path.dirname(module.parent.filename) + '/../res/img/icon.ico')
	}

	setCommands(commands) {
		this.commands = commands
		this.lastCommandExecution = {}

		this.hasTimerCmds = false
		this.timerCmds = []
		this.hasFollowerCmds = false
		this.hasSubscriberCmds = false
		this.hasHostCmds = false
		this.hasWebsocketCmds = false
		for(let i = 0; i < this.commands.length; i++) {
			if(!this.commands[i].active) continue
			let c = this.commands[i].cmd.toLowerCase()

			if(c.startsWith('/timer')) {
				if(this.commands[i].timeout >= 10) {
					this.hasTimerCmds = true;
					this.timerCmds.push(this.commands[i])
				}
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

		this.sync.syncCommands()
		this.removeEventListener()
		this.hookEventlistener()
	}

	getVariables() {
		let vars = []
		for(var index in window.localStorage) {
			if(!index.startsWith('chatbotvar_') || !window.localStorage.hasOwnProperty(index) || typeof(window.localStorage[index]) !== 'string') continue
			vars.push(new VarStorage(index.substr(11)))
		}
		return vars
	}

	hookEventlistener() {
		if(!this.tool.cockpit.openChannelObject.hasOwnProperty('login') || this.tool.cockpit.openChannelObject.login.toLowerCase() != this.auth.username.toLowerCase()) return
		console.log('[chatbot] Creating event listener')
		this.chat.on('chatmessage', this.onChatmessageListener)
		this.chat.on('sendmessage', this.onSendmessageListener)

		if(this.hasTimerCmds) {
			this.timerTimeout = true
			const self = this
			this.onTimerListener = setTimeout(() => {
				self.onTimer()
				self.onTimerListener = setInterval(async () => {
					self.onTimer()
				}, 1000)
				self.timerTimeout = false
			}, 1000 - (new Date().getTime() % 1000))
		}
		if(this.hasFollowerCmds) this.tool.follows.on('follow', this.onFollowListener)
		if(this.hasSubscriberCmds) this.chat.on('usernotice', this.onSubscriberListener)
		if(this.hasHostCmds) {
			this.chat.on('hostingyou', this.onHostListener)
			this.chat.on('autohostingyou', this.onHostListener)
		}
		if(this.hasWebsocketCmds) this.tool.overlays.on('command', this.onWebsocketListener)

		if(this.altAccountLoginToken.length > 0) {
			let username = this.settings.getString('chatbot_username', '')
			if(username.length > 0) {
				const self = this
				this.alttmi = new TMI()
				this.alttmi.on('connect', () => {
					self.alttmi.auth(username, self.altAccountLoginToken)
				})
				this.alttmi.on('registered', () => {
					self.alttmi.join(self.auth.username.toLowerCase())
				})
				this.alttmi.connect()
			}
		}

		if(this.pointsSettings.active) {
			this.pointsTimerTimeout = true
			const self = this
			this.pointsOnTimerListener = setTimeout(async () => {
				self.onPointsTimer()
				self.pointsOnTimerListener = setInterval(async () => {
					self.onPointsTimer()
				}, 60000)
				self.pointsTimerTimeout = false
			}, 60000 - (new Date().getTime() % 60000))
		}
	}

	removeEventListener() {
		console.log('[chatbot] Removing all listener')
		this.chat.removeListener('chatmessage', this.onChatmessageListener)
		this.chat.removeListener('sendmessage', this.onSendmessageListener)

		if(this.timerTimeout !== null) {
			if(!this.timerTimeout)
				clearInterval(this.onTimerListener)
			else
				clearTimeout(this.onTimerListener)
			this.onTimerListener = null
		}
		this.timerTimeout = null

		this.tool.follows.removeListener('follow', this.onFollowListener)
		this.chat.removeListener('usernotice', this.onSubscriberListener)
		this.chat.removeListener('hostingyou', this.onHostListener)
		this.chat.removeListener('autohostingyou', this.onHostListener)
		this.tool.overlays.removeListener('command', this.onWebsocketListener)

		if(this.alttmi !== null) {
			this.alttmi.disconnect()
			this.alttmi = null
		}

		if(this.pointsTimerTimeout !== null) {
			if(!this.pointsTimerTimeout)
				clearInterval(this.pointsOnTimerListener)
			else
				clearTimeout(this.pointsOnTimerListener)
			this.pointsOnTimerListener = null
		}
		this.pointsTimerTimeout = null
	}

	get icon() {
		return 'Robot'
	}

	open() {
		this.contentElement.style.display = 'block'
		this.commandListElement._tag.loadCommands()
	}

	close() {
		this.contentElement.style.display = 'none'
		this.vareditElement.style.display = 'none'
	}

	toggleVarEditView() {
		if(this.contentElement.style.display == 'block') {
			this.contentElement.style.display = 'none'
			this.vareditElement.style.display = 'block'
			if(typeof(this.variablesListElement) !== 'undefined' && this.variablesListElement.hasOwnProperty('_tag')) {
				this.variablesListElement._tag.refreshVars()
			}
		} else if(this.vareditElement.style.display == 'block') {
			this.contentElement.style.display = 'block'
			this.vareditElement.style.display = 'none'
		}
	}

	get altAccountLoginToken()
	{
		return this.settings.getString('chatbot_token', '')
	}

	altAccountLogin()
	{
		if(this.altAccountLoginToken.length <= 0) {
			let authresponseStash = TwitchAuth.prototype.authresponse
			const self = this
			TwitchAuth.prototype.authresponse = async (hash) => {
				let token = ''
				let username = ''
				if(typeof(hash.access_token) != 'undefined' && typeof(hash.state) != 'undefined') {
					if(self.tool.twitchapi.verifyState(hash.state)) {
						try {
							let h = new Helix({ token: hash.access_token })
							let user = await h.getUsers()
							username = user.data[0].login
							token = hash.access_token
						} catch(e) {}
					}
				}
				self.settings.setString('chatbot_username', username)
				self.settings.setString('chatbot_token', token)
				self.altAccountLoginBtn.innerHTML = '<span class="icon icon-twitch"></span> ' + (self.altAccountLoginToken.length > 0 ? self.i18n.__('Logout alternate account') : self.i18n.__('Use alternate account to post responses'))
				TwitchAuth.prototype.authresponse = authresponseStash
				self.removeEventListener()
				self.hookEventlistener()
			}
			this.auth.auth('chatbot-alt')
		} else {
			this.settings.setString('chatbot_username', '')
			this.settings.setString('chatbot_token', '')
			this.altAccountLoginBtn.innerHTML = '<span class="icon icon-twitch"></span> ' + this.i18n.__('Use alternate account to post responses')
			this.removeEventListener()
			this.hookEventlistener()
		}
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
			if(!this.commands[i].active) continue
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

	async executeCommand(msg, cmd, args, cmdstack) {
		if(typeof(cmdstack) === 'undefined')
			cmdstack = []

		console.log('[chatbot] command ' + cmd.cmd + ' is being executed')
		this.lastCommandExecution[cmd.id.toString()] = new Date().getTime()
		let response = cmd.response
		if(Bot.hasStatement(response)) {
			if(typeof(args) === 'undefined') args = this.messageToArgs(msg.msg)
			console.log('[chatbot] processing: ' + response)
			try {
				response = await this.processStatements(response, args, msg)
			} catch(e) {
				console.error(e)
				response = ''
			}
		}
		response = response.replace(/\n/g, ' ')
		response = response.replace(/\t/g, ' ')
		response = response.replace(/\r/g, '')
		response = response.replace(/ +/g, ' ')
		response = response.trim()
		if(response.length > 0) {
			cmdstack.push(cmd.id)

			let msgtags = this.chat.usertags[this.auth.username]
			msgtags.emotes = findEmoticons(response, this.tool.cockpit.emoticons_data)
			let userobj = this.chat.getUserObjByTags(this.auth.username, msgtags)

			console.log('[chatbot] response: ' + response)
			let cs = this.onMessage(userobj, {'chn': this.auth.username, 'usr': userobj, 'msg': response, 'uuid': null}, cmdstack)
			if(cs === false) {
				if(this.alttmi !== null) {
					this.alttmi.say(this.auth.username, response)
				} else {
					this.chat.sendmsg(this.auth.username, response, this.tool.cockpit.emoticons_data)
				}
			} else if(cs === null) {
				this.chat.showmsg('', '', this.auth.username, this.i18n.__('A command loop was detected and stopped.'), {color: '#999999'}, 1)
			}
		} else {
			console.log('[chatbot] response: ')
			this.chat.showmsg('', '', this.auth.username, this.i18n.__('The command response was empty.'), {color: '#999999'}, 1)
		}
	}

	onMessage(user, msg, cmdstack) {
		if(typeof(cmdstack) === 'undefined')
			cmdstack = []

		let message = msg.msg
		let commands = this.filterCommands(message, user)
		if(commands.length > 0) {
			if(cmdstack.indexOf(commands[0].id) >= 0) {
				console.log('[chatbot] detected loop and stopped')
				return null
			}
			let args = this.messageToArgs(message)
			for(let i = 0; i < commands.length; i++) {
				let cmd = commands[i]
				let points = this.getPoints(user.user)
				if(typeof(cmd.points) !== 'number') cmd.points = 0
				if(points >= cmd.points) {
					this.addPoints(user.user, cmd.points * -1)
					this.executeCommand(msg, cmd, args, cmdstack)
				}
			}
			return true
		}
		return false
	}

	async onTimer() {
		if(Tool.channel.streamobject === null || typeof(Tool.channel.streamobject.started_at) !== 'string') return

		let uptime = Math.floor(( (new Date().getTime())-(new Date(Tool.channel.streamobject.started_at).getTime()) ) / 1000)
		for(let i = 0; i < this.timerCmds.length; i++) {
			let cmd = this.timerCmds[i]
			if(
				(cmd.timeout <= 86400 && uptime % cmd.timeout != 0) ||
				(cmd.timeout > 86400 && Math.floor(new Date().getTime() / 1000) != cmd.timeout)
			) continue
			this.executeCommand({'chn': this.tool.cockpit.openChannelObject.login, 'msg': cmd.cmd, 'uuid': null}, cmd)
		}
	}

	onFollow(usr, f) {
		let nowDate = new Date().getTime()
		let followDate = new Date(f.followed_at).getTime()
		if(nowDate-process.uptime() > followDate) return // Follow is older than the application is running?

		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.active || !cmd.cmd.toLowerCase().startsWith('/follow')) continue

			this.executeCommand({'chn': this.tool.cockpit.openChannelObject.login, 'usr': usr, 'msg': cmd.cmd, 'uuid': null}, cmd)
		}
	}

	onSubscriber(chn, usr, tags, msg) {
		if(chn.toLowerCase() != this.auth.username.toLowerCase()) return
		if(tags['msg-id'] == 'raid') {
			onHost(chn, usr, tags['msg-param-viewerCount'], msg, tags)
			return
		}
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
			if(!cmd.active || !cmd.cmd.toLowerCase().startsWith('/sub')) continue

			let cmdargs = cmd.cmd.substr(4).trim()
			let msg = '/sub ' + (typeof(tags['msg-param-cumulative-months']) === 'undefined' ? '1' : tags['msg-param-cumulative-months']) + (cmdargs.length > 0 ? ' ' + cmdargs : '')
			this.executeCommand({'chn': chn, 'usr': usr, 'msg': msg, 'uuid': null}, cmd)
		}
	}

	onHost(chn, usr, viewers, msg, tags) {
		if(chn.toLowerCase() != this.auth.username.toLowerCase()) return

		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.active || !cmd.cmd.toLowerCase().startsWith('/host')) continue

			let cmdargs = cmd.cmd.substr(5).trim()
			let msg = '/host ' + viewers + (cmdargs.length > 0 ? ' ' + cmdargs : '')
			this.executeCommand({'chn': chn, 'usr': usr, 'msg': msg, 'uuid': null}, cmd)
		}
	}

	onWebsocket(command) {
		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.active || !cmd.cmd.toLowerCase().startsWith('/cmd ')) continue
			if(cmd.cmd.substr(5).trim() != command.trim()) continue
			if(typeof(this.lastCommandExecution[cmd.id.toString()]) === 'number' && this.lastCommandExecution[cmd.id.toString()] > new Date().getTime() - (cmd.timeout * 1000)) continue

			this.executeCommand({'chn': this.auth.username.toLowerCase(), 'msg': cmd.cmd, 'uuid': null}, cmd)
		}
	}

	static hasStatement(message){
		if(message.match(/\{(% ?|\{)(.*?)( ?%|\})\}/s)) {
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
		let matches = expression.match(/^(%(\-?[0-9]+)(,\-?[0-9]{0,})?|\/[a-z0-9]+|\$[a-z0-9]+|(🔗|🌎|🌍|🌏)(https?:\/\/.+)|📝([a-z]:(.*?)))(\[(.*?)\])?$/i)
		if(matches !== null) {
			let argMatches = matches[1].match(/^%(\-?[0-9]+)(,\-?[0-9]{0,})?$/)
			if(argMatches) {
				let argIndex1 = parseInt(argMatches[1])
				let argIndex2 = (typeof(argMatches[2]) === 'string' ? argMatches[2].substr(1) : (argIndex1+1 == 0 ? undefined : argIndex1+1))
				if(typeof(argIndex2) === 'string') {
					if(argIndex2.length == 0 || (argIndex2.length == 1 && argIndex2 == '-')) {
						argIndex2 = args.length
					}
				}

				let argSlice = args.slice(argIndex1, argIndex2)
				return new VarArgument(argSlice.join(' '))
			} else if(matches[1].match(/^\/[a-z0-9]+$/i)) {
				return new VarContext(matches[1].substr(1).toLowerCase(), msg)
			} else if(matches[1].match(/^\$[a-z0-9]+$/i)) {
				return new VarStorage(matches[1].substr(1))
			} else if(matches[1].match(/^(🔗|🌎|🌍|🌏)https?:\/\/.+$/i)) {
				return new VarRequest(matches[5])
			} else if(matches[1].match(/^📝([a-z]:(.*?))$/i)) {
				return new VarFile(matches[6])
			}
		} else {
			return new VarArgument(expression)
		}
	}

	/**
	 * @param {string} expression 
	 * @param {string[]} args 
	 * @param {object} msg 
	 * @returns {Promise}
	 */
	getVarIndex(expression, args, msg) {
		return new Promise(async (resolve, reject) => {
			try {
				let matches = expression.match(/^(%(\-?[0-9]+)(,\-?[0-9]{0,})?|\/[a-z0-9]+|\$[a-z0-9]+|(🔗|🌎|🌍|🌏)(https?:\/\/.+)|📝([a-z]:(.*?)))(\[(.*?)\])?$/i)
				if(matches !== null && typeof(matches[8]) !== 'undefined') {
					let indexStr = matches[8].substr(1, matches[8].length-2)
					let interf = this.getVarInterface(indexStr, args, msg)
					if(interf === null) {
						resolve(null)
					} else {
						resolve(await interf.getValue(indexStr))
					}
				} else {
					resolve(null)
				}
			} catch(e) {
				resolve(null)
			}
		})
	}


	processStatements(response, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			let stmtRegex = /\{\{(.*?)\}\}/gs
			let match = null
			let responseResult = ''
			let lastIndex = 0
			while(match = stmtRegex.exec(response)) {
				responseResult += response.substr(lastIndex, (match.index - lastIndex))
				lastIndex = match.index+match[0].length

				let statment = match[1]
				let encodeAfter = false
				if(statment.startsWith('§') && statment.endsWith('§')) {
					encodeAfter = true
					statment = statment.substr(1, statment.length-2)
				}
				
				statment.trim()

				let stmtArgs = self.messageToArgs(statment)
				if(stmtArgs.length > 0) {
					stmtArgs.unshift('print')
					try {
						let stmtResult = await self.processStmtPrint(stmtArgs, args, msg)
						if(encodeAfter) {
							stmtResult = encodeURIComponent(stmtResult)
						}
						responseResult += stmtResult
					} catch(e) {
						console.error(e)
					}
				}
			}
			responseResult += response.substr(lastIndex)
	
			responseResult = await self.processConditionals(responseResult, args, msg)

			resolve(responseResult)
		})
	}

	processConditionals(response, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			let ifRegex = /\{% ?if (.*?) ?%\}/igs
			let elseRegex = /\{% ?else ?%\}/igs
			let endifRegex = /\{% ?endif ?%\}/igs

			let conditionals = []
			while(match = ifRegex.exec(response))		{ match.g = 1; conditionals.push(match) }
			while(match = elseRegex.exec(response))		{ match.g = 2; conditionals.push(match) }
			while(match = endifRegex.exec(response))	{ match.g = 3; conditionals.push(match) }

			conditionals.sort((a, b) => {
				return a.index - b.index
			})

			let responseAfter = ''
			let ifDepth = -1
			let lastIndex = 0
			let lastIf = []
			for(let i = 0; i < conditionals.length; i++) {
				let cond = conditionals[i]
				if(cond.index < lastIndex) continue
				let conditionMet = false
				switch(cond.g) {
					case 1:
						ifDepth++
						if(lastIf.indexOf(false) < 0) {
							let ifArgs = self.messageToArgs(cond[1])
							let condResult = false
							try {
								condResult = await self.processStmtCondition(ifArgs, args, msg)
							} catch(e) { console.error(e) }
							lastIf.push(condResult)
							conditionMet = condResult
						} else {
							lastIf.push(false)
						}
						break
					case 2:
						if((ifDepth >= 0 && lastIf.length > ifDepth && !lastIf[ifDepth]) || ifDepth < 0) {
							conditionMet = true
							for(let i = 0; i < ifDepth; i++) {
								if(!lastIf[i]) conditionMet = false
							}
						}
						break
					case 3:
						conditionMet = true
						if(ifDepth > -1) {
							ifDepth--
							lastIf.pop()
						}
						break
				}

				lastIndex = cond.index + cond[0].length

				let nextIndex = -1
				if(conditionals.length > i+1) nextIndex = conditionals[i+1].index
				else nextIndex = response.length

				if(conditionMet) {
					try {
						responseAfter += await self.processLowPrioStatements(response.substring(lastIndex, nextIndex), args, msg)
					} catch(e) { console.error(e) }
				}
				lastIndex = nextIndex
				
			}
			try {
				responseAfter += await self.processLowPrioStatements(response.substring(lastIndex), args, msg)
			} catch(e) { console.error(e) }

			resolve(responseAfter)
		})
	}

	processLowPrioStatements(response, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			let stmtRegex = /\{% ?(.*?) ?%\}/gs
			let match = null
			let responseResult = ''
			let lastIndex = 0
			while(match = stmtRegex.exec(response)) {
				responseResult += response.substr(lastIndex, (match.index - lastIndex))
				lastIndex = match.index+match[0].length

				try {
					let stmtArgs = self.messageToArgs(match[1])
					if(stmtArgs.length > 0) {
						if(stmtArgs[0].toLowerCase() == 'set' && stmtArgs.length >= 4) {
							await self.processStmtSet(stmtArgs, args, msg)
						} else if((stmtArgs[0].toLowerCase() == 'add' || stmtArgs[0].toLowerCase() == 'sub') && stmtArgs.length >= 4) {
							await self.processStmtAdd(stmtArgs, args, msg)
						} else if(stmtArgs[0].toLowerCase() == 'print' && stmtArgs.length >= 2) {
							responseResult += await self.processStmtPrint(stmtArgs, args, msg)
						}
					}
				} catch(e) {
					console.error(e)
				}
			}

			responseResult += response.substr(lastIndex)
			resolve(responseResult)
		})
	}

	processStmtSet(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[1], args, msg)
				let var1Index = await self.getVarIndex(stmt[1], args, msg)
				let var2 = self.getVarInterface(stmt[3], args, msg)
				let var2Index = await self.getVarIndex(stmt[3], args, msg)

				if(var1 === null || var2 === null) {
					resolve()
					return
				}
				if(['into', '>', '->'].indexOf(stmt[2]) >= 0) {
					await var2.setTo(await var1.getValue(var1Index), var2Index)
				} else if(['<', '<-'].indexOf(stmt[2]) >= 0) {
					await var1.setTo(await var2.getValue(var2Index), var1Index)
				}
			} catch(e) {
				console.error(e)
			}

			resolve()
		})
	}

	processStmtAdd(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[1], args, msg)
				let var1Index = await self.getVarIndex(stmt[1], args, msg)
				let var2 = self.getVarInterface(stmt[3], args, msg)
				let var2Index = await self.getVarIndex(stmt[3], args, msg)

				if(var1 === null || var2 === null) {
					resolve()
					return
				}
				if(stmt[0].toLowerCase() == 'add' && ['>', '->', 'to'].indexOf(stmt[2]) >= 0) {
					await var2.addTo(await var1.getValue(var1Index), var2Index)
				} else if(stmt[0].toLowerCase() == 'add' && ['<', '<-'].indexOf(stmt[2]) >= 0) {
					await var1.addTo(await var2.getValue(var2Index), var1Index)
				} else if(stmt[0].toLowerCase() == 'sub' && stmt[2] == 'from'){
					let val = await var1.getValue(var1Index)
					if((typeof(val) === 'string' && val.match(/^-?([0-9]+)(\.([0-9]+))?$/))) {
						val = parseFloat(val)
					}
					if(typeof(val) === 'number') {
						val = val * -1;
						await var2.addTo(val, var2Index)
					}
				}
			} catch(e) {
				console.error(e)
			}

			resolve()
		})
	}

	processStmtPrint(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[1], args, msg)
				let var1Index = await self.getVarIndex(stmt[1], args, msg)

				if(var1 === null) {
					resolve('')
					return
				}
				let value = await var1.getValue(var1Index)
				if(typeof(value) === 'string' || typeof(value) === 'number') {
					resolve(value.toString())
					return
				}
			} catch(e) {
				console.error(e)
			}
	
			resolve('')
		})
	}

	processStmtCondition(stmt, args, msg) {
		const self = this
		return new Promise(async (resolve, reject) => {
			try {
				let var1 = self.getVarInterface(stmt[0], args, msg)
				let var1Index = await self.getVarIndex(stmt[0], args, msg)
				let var2 = self.getVarInterface(stmt[2], args, msg)
				let var2Index = await self.getVarIndex(stmt[2], args, msg)

				if(var1 === null && var2 === null) {
					resolve(false)
					return
				}

				let var1Value = (var1 === null ? null : await var1.getValue(var1Index))
				let var2Value = (var2 === null ? null : await var2.getValue(var2Index))
				if(stmt[1] == '>') {
					resolve(var1Value > var2Value)
				} else if(stmt[1] == '<') {
					resolve(var1Value < var2Value)
				} else if(stmt[1] == '>=') {
					resolve(var1Value >= var2Value)
				} else if(stmt[1] == '<=') {
					resolve(var1Value <= var2Value)
				} else if(['=', '=='].indexOf(stmt[1]) >= 0) {
					resolve(var1Value == var2Value)
				} else if(['!=', '!'].indexOf(stmt[1]) >= 0) {
					resolve(var1Value != var2Value)
				} else if(stmt[1].toLowerCase() == 'includes') {
					if(typeof(var1Value) === 'string' && (typeof(var2Value) === 'string' || typeof(var2Value) === 'number')) {
						resolve(var1Value.includes(var2Value))
					} else {
						resolve(false)
					}
				} else if(stmt[1].toLowerCase() == 'startswith') {
					if(typeof(var1Value) === 'string' && (typeof(var2Value) === 'string' || typeof(var2Value) === 'number')) {
						resolve(var1Value.startsWith(var2Value))
					} else {
						resolve(false)
					}
				} else if(stmt[1].toLowerCase() == 'endswith') {
					if(typeof(var1Value) === 'string' && (typeof(var2Value) === 'string' || typeof(var2Value) === 'number')) {
						resolve(var1Value.endswith(var2Value))
					} else {
						resolve(false)
					}
				} else {
					resolve(false)
				}
				return
			} catch(e) {
				console.error(e)
			}

			resolve(false)
		})
	}

	registerContext(name, callback) {
		VarContext.registerContext(name, callback)
	}

	openPointSettings()
	{
		let top = BrowserWindow.getFocusedWindow()
		if(top === null && BrowserWindow.getAllWindows().length > 0) {
			top = BrowserWindow.getAllWindows()[0]
		}
		if(top !== null) {
			let pointsWindow = new BrowserWindow({
				title: this.i18n.__('Points system settings'),
				parent: top,
				modal: true,
				autoHideMenuBar: true,
				minimizable: false,
				maximizable: false,
				fullscreenable: false,
				icon: this.getAppIconPath(),
				width: 450,
				height: 650,
				minWidth: 300,
				minHeight: 400,
				x: top.getPosition()[0] + Math.floor(top.getSize()[0]/2) - 225,
				y: top.getPosition()[1] + 60,
				webPreferences: {
					nodeIntegration: true
				}
			})
			const self = this
			pointsWindow.on('close', () => {
				pointsWindow = null
				self.pointsSettings = self.settings.getJSON('chatbot_points_settings', { active: false, ppm: 10, submult: 1, vipmult: 1, modmult: 1 })
				self.removeEventListener()
				self.hookEventlistener()
			})
			pointsWindow.loadURL('file://' + path.join(__dirname, 'views/pointssettings.html'))
		}
	}

	setPoints(username, points)
	{
		if(typeof(username) !== 'string' || username.length <= 0 || typeof(points) !== 'number') return
		if(typeof(this.points[username]) !== 'number') this.points[username] = 0
		this.points[username] = points

		this.settings.setJSON('chatbot_points', this.points)
	}

	addPoints(username, points)
	{
		if(typeof(username) !== 'string' || username.length <= 0 || typeof(points) !== 'number') return
		if(typeof(this.points[username]) !== 'number') this.points[username] = 0
		this.points[username] += points

		this.settings.setJSON('chatbot_points', this.points)
	}

	getPoints(username)
	{
		if(typeof(username) !== 'string' || username.length <= 0 || typeof(this.points[username]) !== 'number') return 0
		if(username.toLowerCase() == Tool.auth.username.toLowerCase()) return Number.MAX_SAFE_INTEGER
		return this.points[username]
	}

	onPointsTimer() {
		if(!this.pointsSettings.active) return
		let ppm = this.pointsSettings.ppm
		for(let u in this.tool.cockpit.userselement._tag.userDictonary) {
			if(!this.tool.cockpit.userselement._tag.userDictonary.hasOwnProperty(u)) continue
			let user = this.tool.cockpit.userselement._tag.userDictonary[u]

			let points = ppm
			let permissions = this.getPermissionLevels(typeof(user.badges) === 'string' ? user.badges : '')
			let mult = 1
			if(permissions.indexOf('subscribers') >= 0 && mult < this.pointsSettings.submult) mult = this.pointsSettings.submult
			if(permissions.indexOf('vip') >= 0 && mult < this.pointsSettings.vipmult) mult = this.pointsSettings.vipmult
			if(permissions.indexOf('moderators') >= 0 && mult < this.pointsSettings.modmult) mult = this.pointsSettings.modmult
			points = points * mult

			this.addPoints(user.user, points)
		}
	}

}

module.exports = Bot