const guestToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiZ3Vlc3QifQ.signature";
document.cookie = `token=${guestToken}; path=/`;

function parseJWT(token) {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
}

function checkAccess() {
    const token = document.cookie
        .split(';')
        .find(c => c.trim().startsWith('token='))
        ?.split('=')[1];

    if (!token) return;

    const payload = parseJWT(token);

    if (payload.role === 'admin') {
        fetch('/api/flag.json')  // only fires if admin
            .then(r => r.json())
            .then(data => {
                window._data = data; // hidden, player finds in Network tab
            });
        document.getElementById('status').innerText = "Access granted.";
    } else {
        document.getElementById('status').innerText = "Insufficient privileges.";
    }
}

checkAccess();
