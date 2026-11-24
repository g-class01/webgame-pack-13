


const scriptsInEvents = {

	async Es_game_Event29_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение
setToStorage("openLVL", runtime.globalVars.openLVL);
	},

	async Es_game_Event37_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName", runtime.globalVars.progressLevel);
	},

	async Es_game_Event54_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("first", runtime.globalVars.First_Start_2);
	},

	async Es_game_Event57_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName5", runtime.globalVars.hintShow);
	},

	async Es_game_Event70_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName2", runtime.globalVars.hintTurns);
	},

	async Es_game_Event76_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName5", runtime.globalVars.hintShow);
	},

	async Es_game_Event120_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName2", runtime.globalVars.hintTurns);
	},

	async Es_game_Event123_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("first", runtime.globalVars.First_Start_2);
	},

	async Es_commom_Event21_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName4", runtime.globalVars.Sound);
	},

	async Es_commom_Event24_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName3", runtime.globalVars.Music);
	},

	async Es_main_Event20_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName", runtime.globalVars.progressLevel);
	},

	async Es_main_Event33_Act1(runtime, localVars)
	{
function setToStorage(name, val) {
    try {
        localStorage.setItem(name, val);
        console.log(`Сохранено: ключ "${name}", значение "${val}"`);
    } catch (e) {
        console.error(`Ошибка при записи "${name}" в localStorage:`, e);
    }
}

// Обновляем и сохраняем значение

setToStorage("storageName", runtime.globalVars.progressLevel);
	},

	async Load2_Event33_Act1(runtime, localVars)
	{
function getFromStorage(name, defaultValue = "0") {
    try {
        let val = localStorage.getItem(name);
        if (val === null || val === undefined) {
            console.log(`Ключ "${name}" не найден. Возвращаем значение по умолчанию: ${defaultValue}`);
            return defaultValue;
        }
        console.log(`Значение для ключа "${name}" найдено: ${val}`);
        return val;
    } catch (e) {
        console.error(`Ошибка при чтении "${name}" из localStorage:`, e);
        return defaultValue; // Возвращаем значение по умолчанию при ошибке
    }
}



// Присваиваем значения глобальным переменным
runtime.globalVars.First_Start_2 = getFromStorage("first", "0");
runtime.globalVars.progressLevel = getFromStorage("storageName", "1");
runtime.globalVars.openLVL = getFromStorage("openLVL", "1");
runtime.globalVars.hintShow = getFromStorage("storageName5", "5");
runtime.globalVars.hintTurns = getFromStorage("storageName2", "5");
runtime.globalVars.Music = getFromStorage("storageName3", "1"); // По умолчанию музыка включена
runtime.globalVars.Sound = getFromStorage("storageName4", "1"); // По умолчанию звук включён

// Проверяем, нужно ли сохранить значения по умолчанию
let firstSaveDone = getFromStorage("firstSaveDone", "0");
if (firstSaveDone === "0") {
	setToStorage("openLVL", runtime.globalVars.openLVL);
	setToStorage("first", runtime.globalVars.First_Start_2);
 	setToStorage("storageName", runtime.globalVars.progressLevel);
    setToStorage("storageName3", runtime.globalVars.Music);
    setToStorage("storageName4", runtime.globalVars.Sound);
    setToStorage("storageName2", runtime.globalVars.hintTurns);
    setToStorage("storageName5", runtime.globalVars.hintShow);
    setToStorage("firstSaveDone", "1"); // Устанавливаем флаг
}
	}

};

self.C3.ScriptsInEvents = scriptsInEvents;

