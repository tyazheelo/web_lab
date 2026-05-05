const ToMainPageNavId = "to-main-page";

(function(){
    const toMainPage = document.getElementById(ToMainPageNavId);

    toMainPage.addEventListener('click', function(event) {
        event.preventDefault();

        window.location.href = '/';
    })
}());

