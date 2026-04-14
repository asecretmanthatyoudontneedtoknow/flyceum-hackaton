import { auth, db, storage } from './firebase-cfg.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const loginScreen = document.getElementById('login-screen');
const adminDashboard = document.getElementById('admin-dashboard');

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
        statusText.innerText = 'Загрузка... Не закрывайте страницу!';
        
        let imageUrl = "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=800&q=80";

        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const storageRef = ref(storage, 'news_images/' + Date.now() + '_' + file.name);
            await uploadBytes(storageRef, file);
            imageUrl = await getDownloadURL(storageRef);
        }

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
        alert("Ошибка публикации. Проверьте правила Storage: " + e.message); 
        statusText.innerText = '';
    }
});