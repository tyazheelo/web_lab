const formOverlay = document.getElementById('form-overlay');
const addBtn = document.getElementById('add-btn');    
const saveBtn = document.getElementById('submit-btn'); 
const cancelBtn = document.getElementById("cancel-btn");

let refreshCatalogCallback = null;
let currentEditingId = null; 

function SetRefreshCatalogCallback(callback) {
    refreshCatalogCallback = callback;
}

function FormReset() {
    const nameInput = document.getElementById('name');
    const costInput = document.getElementById('cost');
    const typeSelect = document.getElementById('type');
    const descriptionTextArea = document.getElementById('description');
    
    if (nameInput) nameInput.value = '';
    if (costInput) costInput.value = '';
    if (typeSelect) typeSelect.value = '';
    if (descriptionTextArea) descriptionTextArea.value = "";
    
    currentEditingId = null;
    showAddMode();
}

function showAddMode() {
    if (addBtn) addBtn.style.display = 'block';
    if (saveBtn) saveBtn.style.display = 'none';
}

function showEditMode() {
    if (addBtn) addBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'block';
}

function SetButtonBehaviour() {
    const itemDeleteBtn = document.querySelectorAll(".item-delete-btn");
    const itemChangeBtn = document.querySelectorAll(".item-change-btn");
    const catalogRegulatorAddBtn = document.getElementById('catalog-regulator-add-btn');

    itemDeleteBtn.forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('Удалить товар?')) return;
            
            try {
                const response = await fetch(`/api/items/${btn.id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    alert('Товар удален');
                    if (refreshCatalogCallback) await refreshCatalogCallback();
                } else {
                    alert('Ошибка при удалении');
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Не удалось удалить товар');
            }
        });
    });

    itemChangeBtn.forEach(btn => {
        btn.addEventListener('click', () => {
            currentEditingId = btn.id;  
            showEditMode();              
            formOverlay.style.display = 'block';
            loadItemForEditing(currentEditingId);
        });
    });

    if (catalogRegulatorAddBtn) {
        catalogRegulatorAddBtn.addEventListener('click', () => {
            FormReset();               
            showAddMode();              
            formOverlay.style.display = 'block';
        });
    }
}

async function loadItemForEditing(itemId) {
    try {
        const response = await fetch(`/api/items/${itemId}`);
        const item = await response.json();
        
        const nameInput = document.getElementById('name');
        const costInput = document.getElementById('cost');
        const typeSelect = document.getElementById('type');
        const descriptionTextArea = document.getElementById('description');
        
        if (nameInput) nameInput.value = item.name;
        if (costInput) costInput.value = item.cost;
        if (typeSelect) typeSelect.value = item.type;
        if (descriptionTextArea) descriptionTextArea.value = item.description || '';
    } catch (error) {
        console.error('Ошибка загрузки товара:', error);
    }
}

(function() {
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            FormReset();               
            formOverlay.style.display = "none";
        });
    }

    if (addBtn) {
        addBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            
            const nameInput = document.getElementById('name');
            const costInput = document.getElementById('cost');
            const typeSelect = document.getElementById('type');
            const descriptionTextArea = document.getElementById('description');
            
            if (!nameInput || !costInput || !typeSelect || !descriptionTextArea) {
                console.error('Элементы формы не найдены');
                alert('Ошибка: не найдены поля формы');
                return;
            }
            
            const newName = nameInput.value.trim();
            const newCost = costInput.value;
            const newType = typeSelect.value;
            const newDescription = descriptionTextArea.value;
            
            console.log('Добавление товара:', { newName, newCost, newType, newDescription });
            
            if (!newName || !newType) {
                alert('Заполните название и тип товара');
                return;
            }
            
            try {
                const response = await fetch('/api/items', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: newName,
                        cost: parseFloat(newCost),
                        type: newType,
                        description: newDescription || ''
                    })
                });
                
                if (response.ok) {
                    FormReset();
                    formOverlay.style.display = "none";
                    if (refreshCatalogCallback) await refreshCatalogCallback();
                    alert('Товар успешно добавлен');
                } else {
                    const error = await response.text();
                    alert(`Ошибка при добавлении: ${error}`);
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Не удалось добавить товар.');
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            
            if (!currentEditingId) {
                alert('Ошибка: не выбран товар для редактирования');
                return;
            }
            
            const nameInput = document.getElementById('name');
            const costInput = document.getElementById('cost');
            const typeSelect = document.getElementById('type');
            const descriptionTextArea = document.getElementById('description');
            
            if (!nameInput || !costInput || !typeSelect || !descriptionTextArea) {
                alert('Ошибка: не найдены поля формы');
                return;
            }
            
            const updatedName = nameInput.value.trim();
            const updatedCost = costInput.value;
            const updatedType = typeSelect.value;
            const updatedDescription = descriptionTextArea.value;
            
            if (!updatedName || !updatedType) {
                alert('Заполните название и тип товара');
                return;
            }
            
            try {
                const response = await fetch(`/api/items/${currentEditingId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: updatedName,
                        cost: parseFloat(updatedCost),
                        type: updatedType,
                        description: updatedDescription || ''
                    })
                });
                
                if (response.ok) {
                    FormReset();  // Сбросит режим на "добавление"
                    formOverlay.style.display = "none";
                    if (refreshCatalogCallback) await refreshCatalogCallback();
                    alert('Товар успешно обновлен');
                } else {
                    const error = await response.text();
                    alert(`Ошибка при обновлении: ${error}`);
                }
            } catch (error) {
                console.error('Ошибка:', error);
                alert('Не удалось обновить товар.');
            }
        });
    }
}());

export { 
    SetButtonBehaviour,
    SetRefreshCatalogCallback
};