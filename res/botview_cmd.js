function charactersRemaining(textarea, limit, output) {
	output.innerText = ' - ' + (limit - textarea.value.length) + ' / ' + limit
}

window.addEventListener('load', () => {
	if(!document.location.hash.startsWith('#command=')) {
		window.close()
		return
	}

	let commands = getJSON('bot_commands')
	let cmdId = parseInt(document.location.hash.substr(9))

	if(cmdId >= commands.length) {
		window.close()
		return
	}
	
	let command = commands[cmdId]

	let command_cmd = document.querySelector('#command_cmd')
	let command_response = document.querySelector('#command_response')
	let command_permission = document.querySelector('#command_permission')
	let command_timeout = document.querySelector('#command_timeout')
	let button_help = document.querySelector('#button_help')
	let button_save = document.querySelector('#button_save')
	let button_cancel = document.querySelector('#button_cancel')
	let char_remain = document.querySelector('#char-remain')

	command_cmd.value = command.cmd
	command_response.value = command.response
	command_permission.value = command.permission
	command_timeout.value = command.timeout

	command_response.addEventListener('keyup', (e) => {
		charactersRemaining(command_response, 500, char_remain)
	})
	charactersRemaining(command_response, 500, char_remain)

	button_help.addEventListener('click', () => {
		let helpWindow = new BrowserWindow({ autoHideMenuBar: true, fullscreenable: false, icon: 'res/icon.ico', width: 800, height: 600, webPreferences: { nodeIntegration: true } })
		let helpFile = path.join(__dirname, 'commandhelp_' + lang + '.html')
		try {
			fs.accessSync(helpFile)
		} catch(e) {
			helpFile = path.join(__dirname, 'commandhelp_en.html')
		}
		helpWindow.loadURL('file://' + helpFile)
	})
	button_save.addEventListener('click', () => {
		command.cmd = command_cmd.value
		command.response = command_response.value
		command.permission = command_permission.value
		command.timeout = command_timeout.value
		if(command.cmd.length <= 0) command.active = false
		commands[cmdId] = command

		setJSON('bot_commands', commands)
		window.close()
	})
	button_cancel.addEventListener('click', () => {
		if(command.cmd.length <= 0) command.active = false
		commands[cmdId] = command
		setJSON('bot_commands', commands)
		window.close()
	})
})