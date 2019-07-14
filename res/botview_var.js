const VarStorage = require('../modules/VarStorage')
let Tool = {
	settings: {
		getString: getString,
		setString: setString
	},
	once() {}
}

function validateNumber(str) {
	if(str.match(/^-?([0-9]+)(\.([0-9]+))?$/)) {
		return parseFloat(str)
	}
	return str
}

let createNewVar = false
let variable_name = null
let variable_type = null

function datatypeStringOrNumber(content) {
	let wrapper = document.querySelector('#variable_content_wrapper')
	wrapper.innerHTML = '<label><input type="text" id="variable_content"></label>'

	let variable_content = document.querySelector('#variable_content')
	variable_content.value = content
}
function datatypeStringValue() {
	let input = document.querySelector('#variable_content')
	return input.value
}
function datatypeNumberValue() {
	let input = document.querySelector('#variable_content')
	let val = validateNumber(input.value)
	if(typeof(val) !== 'number') return 0
	return val
}

let datatypeObjectCount = 0
function datatypeObjectAdd(key, value) {
	if(typeof(key) === 'undefined') key = ''
	if(typeof(value) === 'undefined') value = ''

	let wrapper = document.querySelector('#variable_content_object_wrapper')
	let row = document.createElement('tr')
	let keyCol = document.createElement('td')
	let valueCol = document.createElement('td')
	let delCol = document.createElement('td')
	let keyInput = document.createElement('input')
	keyInput.setAttribute('type', 'text')
	keyInput.classList.add('key')
	keyInput.value = key
	let valueInput = document.createElement('input')
	valueInput.setAttribute('type', 'text')
	valueInput.classList.add('value')
	valueInput.value = value
	let delButton = document.createElement('button')
	delButton.onclick = () => { wrapper.removeChild(row) }
	delButton.innerText = '🗑'

	keyCol.appendChild(keyInput)
	valueCol.appendChild(valueInput)
	delCol.appendChild(delButton)
	row.appendChild(keyCol)
	row.appendChild(valueCol)
	row.appendChild(delCol)

	wrapper.appendChild(row)
	datatypeObjectCount++
}
function datatypeObject(content) {
	let wrapper = document.querySelector('#variable_content_wrapper')
	wrapper.innerHTML = '<table class="datatable" style="width:100%;"><thead><tr><th style="width:45%;">' + i18n.__('Key') + '</th><th style="width:45%;">' + i18n.__('Value') + '</th><th>*</th></tr></thead><tbody id="variable_content_object_wrapper"></tbody></table><button id="variable_content_object_add">+</button>'

	let variable_content_object_add = document.querySelector('#variable_content_object_add')
	variable_content_object_add.onclick = () => { datatypeObjectAdd() }

	datatypeObjectCount = 0
	for(let key in content) {
		datatypeObjectAdd(key, content[key])
	}
}
function datatypeObjectValue() {
	let keyInputs = document.querySelectorAll('#variable_content_object_wrapper input.key')
	let valueInputs = document.querySelectorAll('#variable_content_object_wrapper input.value')
	let values = {}
	keyInputs.forEach((inp, index) => {
		values[inp.value] = validateNumber(valueInputs.item(index).value)
	})
	return values
}


let datatypeArrayCount = 0
function datatypeArrayAdd(key, value) {
	if(typeof(key) === 'undefined') key = ''
	if(typeof(value) === 'undefined') value = ''

	let wrapper = document.querySelector('#variable_content_array_wrapper')
	let row = document.createElement('tr')
	let valueCol = document.createElement('td')
	let delCol = document.createElement('td')
	let valueInput = document.createElement('input')
	valueInput.setAttribute('type', 'text')
	valueInput.classList.add('value')
	valueInput.value = value
	let delButton = document.createElement('button')
	delButton.onclick = () => { wrapper.removeChild(row) }
	delButton.innerText = '🗑'

	valueCol.appendChild(valueInput)
	delCol.appendChild(delButton)
	row.appendChild(valueCol)
	row.appendChild(delCol)

	wrapper.appendChild(row)
	datatypeArrayCount++
}
function datatypeArray(content) {
	let wrapper = document.querySelector('#variable_content_wrapper')
	wrapper.innerHTML = '<table class="datatable" style="width:100%;"><thead><tr><th style="width:90%;">' + i18n.__('Value') + '</th><th>*</th></tr></thead><tbody id="variable_content_array_wrapper"></tbody></table><button id="variable_content_array_add">+</button>'

	let variable_contentarray_add = document.querySelector('#variable_content_array_add')
	variable_content_array_add.onclick = () => { datatypeArrayAdd() }

	datatypeArrayCount = 0
	for(let key in content) {
		datatypeArrayAdd(key, content[key])
	}
}
function datatypeArrayValue() {
	let valueInputs = document.querySelectorAll('#variable_content_array_wrapper input.value')
	let values = []
	valueInputs.forEach((inp) => {
		values.push(validateNumber(inp.value))
	})
	return values
}

window.addEventListener('load', () => {
	if(!document.location.hash.startsWith('#variable=')) {
		window.close()
		return
	}

	let varName = document.location.hash.substr(10)

	let variable = getJSON('chatbotvar_' + varName)

	variable_name = document.querySelector('#variable_name')
	variable_type = document.querySelector('#variable_type')
	
	let button_save = document.querySelector('#button_save')
	let button_cancel = document.querySelector('#button_cancel')

	if(typeof(variable) !== 'undefined') {
		createNewVar = false
		let vst = new VarStorage(varName)

		variable_name.value = vst.name
		variable_type.value = vst.type

		switch(vst.type) {
			case 'string': datatypeStringOrNumber(vst.value); break;
			case 'number': datatypeStringOrNumber(vst.value); break;
			case 'object': datatypeObject(vst.value); break;
			case 'array': datatypeArray(vst.value); break;
		}
	} else {
		createNewVar = true

		variable_name.removeAttribute('readonly')
		variable_type.removeAttribute('disabled')
		datatypeStringOrNumber('')
		variable_type.onchange = () => {
			switch(variable_type.value) {
				case 'string': datatypeStringOrNumber(''); break;
				case 'number': datatypeStringOrNumber(0); break;
				case 'object': datatypeObject({}); break;
				case 'array': datatypeArray([]); break;
			}
		}
	}

	button_save.addEventListener('click', () => {
		let varName = variable_name.value
		if(varName.length > 0) {
			if(varName.match(/^[a-z0-9]+$/i)) {
				let variableTest = getJSON('chatbotvar_' + varName)
				if(createNewVar && typeof(variableTest) !== 'undefined') {
					alert(i18n.__('Variable with this name already exists'))
					return
				}

				let vst = new VarStorage(varName)
				let val = null
				switch(variable_type.value) {
					case 'string': val = datatypeStringValue(); break;
					case 'number': val = datatypeNumberValue(); break;
					case 'object': val = datatypeObjectValue(); break;
					case 'array': val = datatypeArrayValue(); break;
				}
				vst.setTo(val)
				
				window.close()
			} else {
				alert(i18n.__('Variable name can only include letters (A-Z) and numbers (0-9)'))
			}
		} else {
			alert(i18n.__('Variable name must not be empty'))
		}
	})
	button_cancel.addEventListener('click', () => {
		window.close()
	})
})