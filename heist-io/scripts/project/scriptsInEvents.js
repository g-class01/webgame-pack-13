


const scriptsInEvents = {

	async E_sys_Event9_Act1(runtime, localVars)
	{
		function setToStorage(name, val) {
		    try {
		        localStorage.setItem(name, val);
		    } catch (e) {}
		}
		setToStorage("GameSaveHEISTIO", runtime.globalVars.Saved);
	},

	async E_loading_Event1_Act1(runtime, localVars)
	{
		document.addEventListener('keydown', function(event) {
		    if (event.key === 'Tab') {
		        event.preventDefault();
		        window.dispatchEvent(new CustomEvent('customTabPress'));
		    }
		});
		
		document.addEventListener('keyup', function(event) {
		    if (event.key === 'Tab') {
		        window.dispatchEvent(new CustomEvent('customTabRelease'));
		    }
		});
	},

	async E_loading_Event7_Act1(runtime, localVars)
	{
		function getFromStorage(name) {
		    try {
		        let val = localStorage.getItem(name);
		        return val;
		    } catch (e) {}
		}
		
		runtime.globalVars.Saved = getFromStorage("GameSaveHEISTIO");
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;

