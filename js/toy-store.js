import {getAll, save} from "./store.js";
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const filename = path.join(rootDir, 'database', 'toys.json');

const getById = async (id) => {
    const items = await getAll(filename);
    return items.find(item => item.id === id);
};

const addToy = async (itemData) => {
    const { name, cost, type, description } = itemData;
    const items = await getAll(filename);
    const id = await generateNewId(type, items);
    
    const newItem = {
        name: name,
        type: type,
        cost: cost,
        description: description || '', 
        id: id
    };
    
    items.push(newItem);
    
    items.sort((a, b) => {
        const [, numA] = a.id.split('-');
        const [, numB] = b.id.split('-');
        
        if (a.type !== b.type) {
            return b.type.localeCompare(a.type);
        }
        return parseInt(numA, 10) - parseInt(numB, 10);
    });
    
    await save(items, filename);
};

const updateToy = async (id, updatedFields) => {
    const items = await getAll(filename);
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
        return null;
    }
    
    items[index] = { ...items[index], ...updatedFields };
    await save(items, filename);
};

const deleteToyById = async (id) => {
    const items = await getAll(filename);
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
       throw new Error(`Игрушка с id "${id}" не найдена`);
    }
    
    items.splice(index, 1);
    await save(items, filename);
};

const generateNewId = async (type, items) => {
    const sameTypeItems = items.filter(item => item.type === type);
    
    const numbers = sameTypeItems.map(item => {
        const parts = item.id.split('-');
        const numberStr = parts[1];
        return parseInt(numberStr, 10);
    });
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const newNumber = maxNum + 1;
    
    return `${getShortType(type)}-${newNumber}`;
};


const getShortType = (type) =>
{
    switch(type)
    {
        case "Эко-игрушки":
            return "eco";
        case "Развивающие игрушки":
            return "edu";
        default:
            return "none";
    }
}
export {
    getById,
    addToy,
    updateToy,
    deleteToyById,
    filename
};