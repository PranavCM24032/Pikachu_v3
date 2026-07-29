(function () {
    var includes = document.querySelectorAll('[data-include]');
    var count = includes.length;
    var loaded = 0;

    function loadNext() {
        if (loaded >= count) return;
        var el = includes[loaded];
        var url = el.getAttribute('data-include');
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        try {
            xhr.send();
            if (xhr.status === 200 || xhr.status === 0) {
                el.insertAdjacentHTML('afterend', xhr.responseText);
            }
        } catch (e) {
            console.error('Include failed:', url, e);
        }
        el.remove();
        loaded++;
        loadNext();
    }

    loadNext();
})();