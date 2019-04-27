riot.tag2('botcommands', '<p> {lang_desc} </p> <table class="datatable" style="width:100%;"> <thead> <tr><th>{lang_command}</th><th>{lang_response}</th><th>{lang_action}</th></tr> </thead> <tbody> <tr each="{commands}"> <td>{cmd}</td> <td>{response}</td> <td><button onclick="{editCommand}">{lang_edit}</button> <button onclick="{deleteCommand}">{lang_delete}</button></td> </tr> </tbody> <tfoot> <tr> <td colspan="3"><button onclick="{createCommand}">{lang_new}</button></td> </tr> </tfoot> </table>', 'botcommands { display: block; padding: 10px; }', '', function(opts) {
		const self = this

		const {BrowserWindow} = remote

		this.i18n = opts.i18n
		this.addonDirname = opts.addonDirname
		this.commands = []
		this.lang_desc = this.i18n.__('Please note that these commands only work in your own channel.')
		this.lang_command = this.i18n.__('Command')
		this.lang_response = this.i18n.__('Response')
		this.lang_action = this.i18n.__('Action')
		this.lang_edit = this.i18n.__('Edit')
		this.lang_delete = this.i18n.__('Delete')
		this.lang_new = this.i18n.__('New Command')

		this.loadCommands = function() {
			self.commands = []
			self.commands = Tool.settings.getJSON('bot_commands', [])
			Tool.ui.findPage('Bot').setCommands(self.commands)
			self.update()
		}.bind(this)

		this.saveCommands = function() {
			Tool.settings.setJSON('bot_commands', self.commands)
			Tool.ui.findPage('Bot').setCommands(self.commands)
		}.bind(this)

		this.openEditWindow = function(index) {
			let top = BrowserWindow.getFocusedWindow()
			if(top === null && BrowserWindow.getAllWindows().length > 0) {
				top = BrowserWindow.getAllWindows()[0]
			}
			if(top !== null) {
				let editWindow = new BrowserWindow({
					title: self.i18n.__('Edit Bot Command'),
					parent: top,
					modal: true,
					autoHideMenuBar: true,
					minimizable: false,
					maximizable: false,
					fullscreenable: false,
					icon: 'res/icon.ico',
					width: 450,
					height: 600,
					minWidth: 300,
					minHeight: 400,
					webPreferences: {
						nodeIntegration: true
					}
				})
				editWindow.on('close', () => {
					editWindow = null
					self.loadCommands()
				})
				editWindow.loadURL('file://' + path.join(this.addonDirname, 'views/editcommand.html') + '#command=' + index)
			}
		}.bind(this)

		this.on('mount', () => {
			self.loadCommands()
		})

		this.editCommand = function(e) {
			self.openEditWindow(self.commands.indexOf(e.item))
		}.bind(this)

		this.deleteCommand = function(e) {
			let remove = self.commands.indexOf(e.item)
			if(confirm(self.i18n.__('Are you sure to delete the command {{command}}?', {'command':  e.item.cmd}))) {
				self.commands.splice(remove, 1)
				self.saveCommands()
			}
		}.bind(this)

		this.createCommand = function() {
			self.commands.push({
				cmd: '',
				response: '',
				permission: 'broadcaster',
				timeout: 5
			})
			self.saveCommands()
			self.openEditWindow(self.commands.length -1)
		}.bind(this)
});