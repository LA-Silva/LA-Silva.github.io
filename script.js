// script.js
let siteData = {};
let publicData = {};
let privateData = {};
let isAuthenticated = false;

// --- UTILITIES ---
function getCookie(name) {
    let value = "; " + document.cookie;
    let parts = value.split("; " + name + "=");
    if (parts.length == 2) return parts.pop().split(";").shift();
}

function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        let date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function deleteCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// --- CORE CMS LOGIC ---
async function loadSiteData() {
    try {
        const pubResponse = await fetch('site_data_public.json');
        publicData = await pubResponse.json();

        const rawPassword = getCookie('site_password');
        
        if (rawPassword) {
            const hashedPassword = CryptoJS.SHA256(rawPassword).toString();
            const privResponse = await fetch('site_data_private.json');
            const encryptedText = await privResponse.text();
            
            try {
                const bytes = CryptoJS.AES.decrypt(encryptedText, hashedPassword);
                const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
                
                if (decryptedString) {
                    privateData = JSON.parse(decryptedString);
                    isAuthenticated = true;
                } else {
                    deleteCookie('site_password');
                    isAuthenticated = false;
                }
            } catch (e) {
                deleteCookie('site_password');
                isAuthenticated = false;
            }
        } else {
            isAuthenticated = false;
        }

        // --- SIMPLY COMBINE, NO SORTING NEEDED HERE ---
        siteData = { ...publicData, ...privateData };
        // ----------------------------------------------

        generateNav();
        updateAuthButton();
        checkTheme();
        renderPage();
    } catch (err) {
        console.error("Error loading data:", err);
    }
}



function updateAuthButton() {
    const container = document.getElementById('authButtonContainer');
    if (isAuthenticated) {
        container.innerHTML = `<button id="logoffBtn" onclick="logoff()">Logoff</button>`;
    } else {
        container.innerHTML = `<button class="action-btn" onclick="showLoginForm()">Login</button>`;
    }
}

function showLoginForm() {
    document.getElementById('content').innerHTML = `
        <div class="login-container">
            <h2>Secure Access</h2>
            <input type="text" id="userInput" placeholder="Username or Email">
            <input type="password" id="passInput" placeholder="Password">
            <button class="action-btn" onclick="login()">Submit</button>
        </div>
    `;
}



async function login() {
    const pass = document.getElementById('passInput').value;
    
    // Set cookie
    setCookie('site_password', pass, 30);

    // Call data load
    await loadSiteData();

    // Check auth state
    if (!isAuthenticated) {
        showLoginForm(); // Re-render form
        const form = document.querySelector('.login-container');
        // Add the error message
        form.insertAdjacentHTML('afterbegin', `<p style="color: red; font-weight: bold;">Wrong Password. Please try again.</p>`);
    }
}



function logoff() {
    deleteCookie('site_password');
    isAuthenticated = false;
    privateData = {}; // Clear private data from memory
    loadSiteData();
}

function generateNav() {
    const navDiv = document.getElementById('navLinks');
    let navHTML = '';
    
    // Create a link for every key in the combined JSON object
    for (const key in siteData) {
        const displayName = key.charAt(0).toUpperCase() + key.slice(1);
        navHTML += `<a href="#${key}">${displayName}</a>`;
    }
    
    navDiv.innerHTML = navHTML;
}

function renderPage() {
    const contentDiv = document.getElementById('content');
    
    // Extract key and potential query from hash
    const hashParts = window.location.hash.replace("#", "").split("?");
    const pageKey = hashParts[0] || "home";
    const searchParams = new URLSearchParams(hashParts[1]);
    const query = searchParams.get('search');
    
    if (siteData[pageKey]) {
        
        // --- SECURITY CHECK ---
        // If it's in privateData but we aren't authenticated, show form
        if (privateData[pageKey] && !isAuthenticated) {
            showLoginForm();
            return;
        }
        // ----------------------

        let markdown = siteData[pageKey];
        
        // Highlight text if query exists
        if (query) {
            const regex = new RegExp(`(${query})`, 'gi');
            markdown = markdown.replace(regex, '<mark>$1</mark>');
        }

        contentDiv.innerHTML = marked.parse(markdown);
        highlightActiveNavLink(pageKey);
    } else {
        contentDiv.innerHTML = "<h2>404</h2><p>Page not found.</p>";
    }
}

// --- ACTIVE NAV LINK ---
function highlightActiveNavLink(pageKey) {
    const navLinks = document.querySelectorAll('#navLinks a');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === `#${pageKey}`) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// --- SEARCH FUNCTIONALITY ---
function performSearch() {
    const query = document.getElementById('searchBox').value.toLowerCase();
    const contentDiv = document.getElementById('content');
    
    if (query.length < 2) {
        const pageKey = window.location.hash.replace("#", "").split("?")[0] || "home";
        window.location.hash = pageKey;
        return;
    }

    let resultsHTML = `<h2>Search Results for: "${query}"</h2>`;
    let found = false;

    for (const key in siteData) {
        const content = siteData[key];
        if (content.toLowerCase().includes(query)) {
            
            const regex = new RegExp(`(${query})`, 'gi');
            const highlightedSnippet = content
                .substring(0, 150)
                .replace(regex, '<mark>$1</mark>');

            resultsHTML += `
                <div class="search-result">
                    <a href="#${key}?search=${query}">${key.charAt(0).toUpperCase() + key.slice(1)}</a>
                    <p>${highlightedSnippet}...</p>
                </div>
            `;
            found = true;
        }
    }

    if (!found) resultsHTML += "<p>No results found.</p>";
    contentDiv.innerHTML = resultsHTML;
}

// --- DARK MODE TOGGLE ---
function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeToggle').innerText = "Light Mode";
    } else {
        localStorage.setItem('theme', 'light');
        document.getElementById('themeToggle').innerText = "Dark Mode";
    }
}

function checkTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').innerText = "Light Mode";
    }
}

// --- INITIALIZATION ---
window.addEventListener('hashchange', renderPage);
loadSiteData();
