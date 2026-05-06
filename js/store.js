import fs from 'node:fs/promises';

const save = async (data, filename) => {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
};

const readData = async (filename) => {
    const data = await fs.readFile(filename, 'utf-8');
    return JSON.parse(data);
};

const getAll = async (filename) => {
    const data = await readData(filename);
    return data || [];
};

export{
    getAll,
    readData,
    save
}