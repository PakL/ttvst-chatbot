window.addEventListener('load', () => {
	let settings = getJSON('chatbot_points_settings', { active: false, ppm: 10, submult: 1, vipmult: 1, modmult: 1 })

	let points_active = document.querySelector('#points_active')
	let points_ppm = document.querySelector('#points_ppm')
	let points_submult = document.querySelector('#points_submult')
	let points_vipmult = document.querySelector('#points_vipmult')
	let points_modmult = document.querySelector('#points_modmult')

	points_active.checked = settings.active
	points_ppm.value = settings.ppm
	points_submult.value = settings.submult
	points_vipmult.value = settings.vipmult
	points_modmult.value = settings.modmult

	let button_save = document.querySelector('#button_save')
	let button_cancel = document.querySelector('#button_cancel')

	button_save.addEventListener('click', () => {
		setJSON('chatbot_points_settings', { active: points_active.checked, ppm: parseInt(points_ppm.value), submult: parseFloat(points_submult.value), vipmult: parseFloat(points_vipmult.value), modmult: parseFloat(points_modmult.value) })
		window.close()
	})
	button_cancel.addEventListener('click', () => {
		window.close()
	})
})