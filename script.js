body {
    margin: 0;
    font-family: Arial, sans-serif;
    background-color: #f0f0f0;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    align-items: center;
    justify-content: center;
}
main {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
}
#game {
    text-align: center;
    background-color: white;
    padding: 20px;
    border-radius: 10px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
#tapArea {
    width: 300px;
    height: 300px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 24px;
    color: white;
    cursor: pointer;
    border-radius: 50%;
    user-select: none;
    background-color: #3D5A80;
    background-image: url('https://i.ibb.co/ySWx2mC/image.png');
    background-size: cover;
    background-position: center;
    transition: transform 0.05s ease-in-out;
}
#tapArea:hover {
    transform: scale(1.05);
}
#coins {
    margin-top: 20px;
    font-size: 30px;
}
@media (max-width: 768px) {
    #tapArea {
        width: 250px;
        height: 250px;
        font-size: 20px;
    }
    #coins {
        font-size: 24px;
    }
}
@media (max-width: 480px) {
    #tapArea {
        width: 200px;
        height: 200px;
        font-size: 16px;
    }
    #coins {
        font-size: 20px;
    }
}
