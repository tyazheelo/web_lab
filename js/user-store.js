import path from 'node:path';
import {getAll, save} from "./store.js";
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const filename = path.join(rootDir, 'database', 'users.json');

const addUser = async(userData) => {
    const {username, password} = userData;
    const isExist = await isUserExists(username);
    if(!isExist){
        const newUser = {
            username: username,
            password: password
        };
        const users = await getAll(filename);
        users.push(newUser);
        await save(users, filename);
    }
    else{
        throw new Error(`${userData.username} has already exist`);
    }
};

const isUserExists = async(username) => {
    const users = await getAll(filename);
    if(users.find(user => user.username === username))
        return true;
    return false;
}

const isPasswordCorrect = async(userData) => {
    const {username, password} = userData;
    const users = await getAll(filename);
    const user = users.find(user => user.username === username);
    if(!user || user.password !== password)
        throw new Error('Неверный логин или пароль');
}

export {
    addUser,
    isPasswordCorrect,
}