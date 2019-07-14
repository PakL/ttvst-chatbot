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
let i18n = new i18n_mod(lang, document.location.pathname.substr(1, document.location.pathname.lastIndexOf('/')) + '../language.json')

window.addEventListener('load', () => {
	let toTranslate = document.querySelectorAll('.i18n')
	for(let i = 0; i < toTranslate.length; i++) {
		toTranslate[i].innerText = i18n.__(toTranslate[i].dataset.translate)
	}
})