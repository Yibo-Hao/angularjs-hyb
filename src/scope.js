function Scope() {
    this.$$watchers = [];
}
function initWatchVal() {}

Scope.prototype.$watch = function (watchFn, listenerFn) {
    const watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn,
        last: initWatchVal
    };
    this.$$watchers.push(watcher);
};

Scope.prototype.$digest = function () {
    this.$$watchers.forEach((watcher) => {
        let newValue, oldValue;
        newValue = watcher.watchFn(this);
        oldValue = watcher.last;
        if (newValue !== oldValue) {
            watcher.last = newValue;
            watcher.listenerFn(newValue, oldValue, this);
        }
    })
}

export default Scope;
