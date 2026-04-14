import { auth, db } from './firebase-cfg.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
// Storage больше не импортируем, он нам не нужен!

const loginScreen = document.getElementById('login-screen');
const adminDashboard = document.getElementById('admin-dashboard');

// СЮДА ВСТАВЬ СВОЙ КЛЮЧ ОТ IMGBB
const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY; 

onAuthStateChanged(auth, (user) => {
    if (user) {
        loginScreen.classList.add('hidden');
        adminDashboard.classList.remove('hidden');
    } else {
        loginScreen.classList.remove('hidden');
        adminDashboard.classList.add('hidden');
    }
});

document.getElementById('login-btn').addEventListener('click', () => {
    signInWithEmailAndPassword(auth, document.getElementById('email').value, document.getElementById('password').value)
    .catch(e => alert("Ошибка входа: " + e.message));
});

document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

document.getElementById('post-news-btn').addEventListener('click', async () => {
    const titleInput = document.getElementById('news-title');
    const bodyInput = document.getElementById('news-body');
    const imageInput = document.getElementById('news-image');
    const statusText = document.getElementById('upload-status');

    if (!titleInput.value || !bodyInput.value) return alert("Заполните заголовок и текст!");
    
    try {
        statusText.innerText = 'Загрузка картинки на хостинг...';
        
        // Заглушка, если фото не выбрали
        let imageUrl = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80";

        // Если файл выбран, отправляем его на ImgBB
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            
            if (data.success) {
                imageUrl = data.data.url; // Получаем прямую ссылку на загруженную картинку
            } else {
                throw new Error("Ошибка ImgBB: " + data.error.message);
            }
        }

        statusText.innerText = 'Сохранение в базу данных...';

        // Сохраняем готовую ссылку в Firestore
        await addDoc(collection(db, "news"), { 
            title: titleInput.value, 
            body: bodyInput.value, 
            imageUrl: imageUrl, 
            date: serverTimestamp() 
        });

        alert("Новость успешно опубликована!");
        titleInput.value = ''; 
        bodyInput.value = ''; 
        imageInput.value = '';
        statusText.innerText = '';
    } catch (e) { 
        alert("Ошибка публикации: " + e.message); 
        statusText.innerText = '';
    }
});