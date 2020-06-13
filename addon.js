const UIPage  = require(path.dirname(module.parent.filename) + '/../mod/uipage')
const TMI = require(path.dirname(module.parent.filename) + '/../lib/twitchchat')
const Helix = require(path.dirname(module.parent.filename) + '/../lib/twitchhelix')
const TwitchAuth = require(path.dirname(module.parent.filename) + '/../mod/auth')
const fs = require('fs')

const { BrowserWindow } = require('electron').remote

const VarStorage = require('./modules/VarStorage')
const VarContext = require('./modules/VarContext')

const Sync = require('./sync')
const CommandExecution = require('./CommandExecution')

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
		this.onChannelPointsListener = async (id, title, user, cost, icon) => { self.onChannelPoints(id, title, user, cost, icon) }

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



		this.rewardWindow = document.createElement('webview')
		this.rewardWindow.style.display = 'none'
		this.contentElement.appendChild(this.rewardWindow)
		this.rewardWindow.addEventListener('console-message', (log) => {
			if(log.message.startsWith('retry:')) {
				try {
					let options = JSON.parse(log.message.substr(6))
					if(options.attempt < 3) {
						console.log('[chatbot] Reward status update unsuccessful, retrying in 2 seconds')
						self.updateRewardStatus(options.reward, options.user, options.executed, options.attempt)
					} else {
						console.log('[chatbot] Reward status update unsuccessful, giving up')
					}
				} catch(e) {}
			}
		})

		this.tool.cockpit.on('channelopen', () => {
			this.hookEventlistener()
			this.loadRewardQueue()
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
		this.hasChannelPointsCmds = false

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
			} else if(c.startsWith('/redeemed ')) {
				this.hasChannelPointsCmds = true
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
		if(this.hasChannelPointsCmds) this.tool.pubsub.on('reward-redeemed', this.onChannelPointsListener)

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
		this.tool.pubsub.removeListener('reward-redeemed', this.onChannelPointsListener)

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

	onChannelPoints(id, title, user, cost, icon) {
		let rewardState = 0
		for(let i = 0; i < this.commands.length; i++) {
			let cmd = this.commands[i]
			if(!cmd.active || !cmd.cmd.toLowerCase().startsWith('/redeemed ')) continue
			if(cmd.cmd.substr(10).trim() != title && cmd.cmd.substr(10).trim() != id) continue
			if(rewardState < 1) rewardState = 1
			if(typeof(this.lastCommandExecution[cmd.id.toString()]) === 'number' && this.lastCommandExecution[cmd.id.toString()] > new Date().getTime() - (cmd.timeout * 1000)) continue

			let msg = '/redeemed ' + title + ' ' + cost
			this.executeCommand({'chn': this.auth.username.toLowerCase(), 'usr': { user: user.login, name: user.display_name }, 'msg': msg, 'uuid': null}, cmd)
			if(rewardState < 2) rewardState = 2
		}
		if(rewardState > 0) {
			this.updateRewardStatus(title, user.display_name, (rewardState == 1 ? false : true))
		}
	}

	async executeCommand(msg, cmd, args, cmdstack) {
		let cmdExe = new CommandExecution(this)
		cmdExe.executeCommand(msg, cmd, args, cmdstack)
	}

	static hasStatement(message){
		if(message.match(/\{(% ?|\{)(.*?)( ?%|\})\}/s)) {
			return true
		}
		return false
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
		if(this.tool.channel.streamobject == null || typeof(this.tool.channel.streamobject.started_at) == 'undefined') return
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

	loadRewardQueue() {
		this.rewardWindow.setAttribute('src', 'https://www.twitch.tv/popout/wolfsterror/reward-queue')
		//if(!this.tool.cockpit.openChannelObject.hasOwnProperty('login') || this.tool.cockpit.openChannelObject.login.toLowerCase() != this.auth.username.toLowerCase()) return
		//this.rewardWindow.setAttribute('src', 'https://www.twitch.tv/popout/' + this.tool.cockpit.openChannelObject.login.toLowerCase() + '/reward-queue')
	}

	updateRewardStatus(title, user, executed, attempt) {
		if(typeof(attempt) !== 'number') attempt = 0
		if(attempt > 5) return; // Give up

		const self = this
		setTimeout(() => {
			console.log('[chatbot] Marking reward as ' + (executed ? 'satisfied' : 'rejected') + ' for ' + user + '\'s ' + title + ' (attempt ' + attempt + ')')
			self.rewardWindow.getWebContents().executeJavaScript('\
				var rewardsObjects = document.querySelectorAll(\'.redemption-list-item__body\');\
				var success = false;\
				for(var i = 0; i < rewardsObjects.length; i++) {\
					var rwname = rewardsObjects[i].querySelector(\'.tw-align-items-start p.tw-semibold\').innerText;\
					var usname = rewardsObjects[i].querySelector(\'.redemption-list-item__context span > span\').innerText;\
					if(rwname == "' + title.replace(/"/g, '\\"') + '" && usname.toLowerCase() == "' + user.toLowerCase().replace(/"/g, '\\"') + '") {\
						rewardsObjects[i].querySelector(\'button[data-test-selector="' + (executed ? 'complete' : 'reject') + '-button"]\').click();\
						success = true;\
						break;\
					}\
				}\
				if(!success)\
					console.log(\'retry:\' + JSON.stringify({user:\'' + title.replace(/'/g, '\\\'') + '\',reward:\'' + user.replace(/'/g, '\\\'') + '\',executed:' + (executed ? 'true' : 'false') + ',attempt:' + (attempt+1) + '}));\
			', true)
		}, 2000)
	}

}

module.exports = Bot