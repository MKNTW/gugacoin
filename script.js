// Function to retrieve ZCOIN from local storage
function getCoinsFromStorage() {
    return parseFloat(localStorage.getItem('coins')) || 0;
}

// Function to save ZCOIN to local storage
function saveCoinsToStorage(coins) {
    localStorage.setItem('coins', coins.toString());
}

let coins = getCoinsFromStorage();
document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(4)}`;

document.getElementById('tapArea').addEventListener('click', function() {
    coins += 0.0001;
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(4)}`;
    saveCoinsToStorage(coins);

    // Button press animation
    this.style.transform = 'scale(0.95)';
    setTimeout(() => {
        this.style.transform = 'scale(1)';
    }, 50);
});

// On page load, update coins from storage
window.onload = function() {
    coins = getCoinsFromStorage();
    document.getElementById('coins').innerText = `ZCOIN: ${coins.toFixed(4)}`;
};
