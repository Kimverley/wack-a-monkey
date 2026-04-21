let playBtn = document.getElementById("play-btn");
let startScreen = document.getElementById("startScreen");
let modal = document.getElementById("modal")
let startGame = document.getElementById('startGame')

playBtn.addEventListener("click", function () {
  console.log("click");
  startScreen.style.display = "none";
  modal.style.visibility = "visible";
  modal.style.top ='5%'
});

startGame.addEventListener('click', function(){
    console.log('click')
})


