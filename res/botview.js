const i18n_mod = require(appPath + '\\node_modules\\i18n-nodejs')

/**
 * Gets a string from the localStorage.
 * 
 * @param {String} name Name of the localStorage value
 * @param {String} defaultValue The default value you want returned if storage value was not found
 */
function getString(name, defaultValue) {
	if(name.length <= 0) return defaultValue;
	let item = window.localStorage.getItem(name)
	if(item != null) {
		return item
	}

	return defaultValue
}

/**
 * Sets a string to the localStroage.
 * 
 * @param {String} name Name of the localStorage value
 * @param {String} value The value you want to set
 */
function setString(name, value) {
	window.localStorage.setItem(name, value)
}

/**
 * Gets a object from the localStorage.
 * 
 * @param {String} name Name of the localStorage value
 * @param {Object} defaultValue The default value you want returned if storage value was not found
 */
function getJSON(name, defaultValue) {
	if(name.length <= 0) return defaultValue;
	let item = window.localStorage.getItem(name)
	if(item != null) {
		try {
			return JSON.parse(item)
		} catch(e) { console.error(e) }
	}
	return defaultValue
}

/**
 * Sets a JSON object to the localStorage.
 * 
 * @param {String} name Name of the localStorage value
 * @param {Object} value The value you want to set
 */
function  setJSON(name, value) {
	try {
		window.localStorage.setItem(name, JSON.stringify(value))
	} catch(e) { console.error(e) }
}


let lang = getString('language', 'en')
let i18n = new i18n_mod(lang, document.location.pathname.substr(1, document.location.pathname.length-17) + '../language.json')


function charactersRemaining(textarea, limit, output) {
	output.innerText = ' - ' + (limit - textarea.value.length) + ' / ' + limit
}

window.addEventListener('load', () => {
	let toTranslate = document.querySelectorAll('.i18n')
	for(let i = 0; i < toTranslate.length; i++) {
		toTranslate[i].innerText = i18n.__(toTranslate[i].dataset.translate)
	}

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
		commands[cmdId] = command

		commands.sort((a, b) => {
			return a.cmd.localeCompare(b.cmd)
		})
		setJSON('bot_commands', commands)
		window.close()
	})
	button_cancel.addEventListener('click', () => {
		window.close()
	})
})