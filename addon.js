const UIPage  = require(path.dirname(module.parent.filename) + '/../mod/uipage')
const fs = require('fs')

const VarInterface = require('./modules/VarInterface')
const VarArgument = require('./modules/VarArgument')
const VarStorage = require('./modules/VarStorage')
const VarContext = require('./modules/VarContext')
const VarRequest = require('./modules/VarRequest')

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

		this.timerTimeout = null
		this.hasTimerCmds = false
		this.timerCmds = []
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
		return path.normalize(path.dirname(module.parent.filename) + '/../res/icon.ico')
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
				if(this.commands[i].timeout > 10) {
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
	}

	get icon() {
		return '🤖'
	}

	open() {
		this.contentElement.style.display = 'block'
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
				this.chat.sendmsg(this.auth.username, response, this.tool.cockpit.emoticons_data)
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
				this.executeCommand(msg, cmd, args, cmdstack)
			}
			return true
		}
		return false
	}

	async onTimer() {
		for(let i = 0; i < this.timerCmds.length; i++) {
			let cmd = this.timerCmds[i]
			if(Math.floor(new Date().getTime()/1000) % cmd.timeout != 0) continue
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
		let matches = expression.match(/^(%(\-?[0-9]+)(,\-?[0-9]{0,})?|\/[a-z]+|\$[a-z0-9]+|(🔗|🌎|🌍|🌏)(https?:\/\/.+))(\[(.*?)\])?$/i)
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
			} else if(matches[1].match(/^\/[a-z]+$/i)) {
				return new VarContext(matches[1].substr(1).toLowerCase(), msg)
			} else if(matches[1].match(/^\$[a-z0-9]+$/i)) {
				return new VarStorage(matches[1].substr(1))
			} else if(matches[1].match(/^(🔗|🌎|🌍|🌏)https?:\/\/.+$/i)) {
				return new VarRequest(matches[5])
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
				let matches = expression.match(/^(%(\-?[0-9]+)(,\-?[0-9]{0,})?|\/[a-z]+|\$[a-z0-9]+|(🔗|🌎|🌍|🌏)(https?:\/\/.+))(\[(.*?)\])?$/i)
				if(matches !== null && typeof(matches[6]) !== 'undefined') {
					let indexStr = matches[6].substr(1, matches[6].length-2)
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
				if(statment.startsWith('§') && statment.endswith('§'))
					encodeAfter = true
	
				let stmtArgs = self.messageToArgs()
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
				try {
					responseAfter += await self.processLowPrioStatements(response.substring(lastIndex, cond.index), args, msg)
				} catch(e) { console.error(e) }
				let conditionMet = false
				switch(cond.g) {
					case 1:
						ifDepth++
						let ifArgs = self.messageToArgs(cond[1])
						let condResult = false
						try {
							condResult = await self.processStmtCondition(ifArgs, args, msg)
						} catch(e) { console.error(e) }
						lastIf.push(condResult)
						conditionMet = condResult
						break
					case 2:
						if((ifDepth >= 0 && lastIf.length > ifDepth && !lastIf[ifDepth]) || ifDepth < 0) {
							conditionMet = true
						}
						break
					case 3:
						if(ifDepth > -1) {
							ifDepth--
							lastIf.pop()
						}
						break
				}

				lastIndex = cond.index + cond[0].length

				if(!conditionMet && cond.g < 3) {
					lastIndex = response.length
					let curDepth = ifDepth
					i++
					while(i < conditionals.length) {
						if(conditionals[i].g == 1) {
							curDepth++
						} else if(conditionals[i].g == 3 || (cond.g == 1 && conditionals[i].g == 2)) {
							curDepth--
						}
						if(conditionals[i].g != 1) {
							if(curDepth < ifDepth) {
								lastIndex = conditionals[i].index
								break
							}
						}
						i++
					}
				}
				
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
						} else if(stmtArgs[0].toLowerCase() == 'add' && stmtArgs.length >= 4) {
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
				if(['>', '->', 'to'].indexOf(stmt[2]) >= 0) {
					await var2.addTo(await var1.getValue(var1Index), var2Index)
				} else if(['<', '<-'].indexOf(stmt[2]) >= 0) {
					await var1.addTo(await var2.getValue(var2Index), var1Index)
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

}

module.exports = Bot