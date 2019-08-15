const request = require(path.dirname(module.parent.parent.filename) + '/../node_modules/request-promise-native')

class ChatbotSync {

	constructor(chatbot)
	{
		this.chatbot = chatbot
		this.settings = this.chatbot.tool.settings
		this._syncing = false
		this._repeatsync = false
	}

	async syncCommands()
	{
		if(!this.settings.getBoolean('cloud-save', false)) return
		if(this._syncing) {
			this._repeatsync = true
			return
		}

		this._syncing = true

		let commands = this.settings.getJSON('bot_commands', [])
		let commandsFiltered = []
		for(let i = 0; i < commands.length; i++) {
			if(
				commands[i].active &&
				commands[i].cmd.length > 0 &&
				!commands[i].cmd.startsWith('/') &&
				commands[i].permission == 'everybody'
			)
				commandsFiltered.push(commands[i])
		}

		await this.settings.cloudRetryIfForbidden(this.cloudPush, this.settings.getString('cloud-token', ''), JSON.stringify(commandsFiltered))

		
		if(this._repeatsync) {
			const self = this
			setTimeout(() => {
				self._syncing = false
				self._repeatsync = false
				self.syncCommands()
			}, 2000)
		} else {
			this._syncing = false
		}
	}

	async cloudPush(token, data)
	{
		console.log('[chatbot] Pushing data to server')
		try {
			let response = await request.post('https://bot.ttvst.app/', { timeout: 10000, json: true, body: {'action': 'push', 'token': token, 'data': data } })
			return response
		} catch(e) {
			if(typeof(e.error) !== 'undefined' && typeof(e.error.status) !== 'undefined') {
				if(e.error.status == 403) {
					return false
				}
				this._tool.ui.showErrorMessage(new Error('Cloud sync error: ' + e.error.error))
				console.error(e.error)
			} else {
				this._tool.ui.showErrorMessage(new Error('Unexpected cloud sync error'))
				console.error(e)
			}
		}
		return null
	}
}
module.exports = ChatbotSync