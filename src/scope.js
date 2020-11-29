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
    let dirty;
    do {
        dirty = this.$$digestOnce();
    } while (dirty);
}

Scope.prototype.$$digestOnce = function () {
    let newValue, oldValue, dirty;
    this.$$watchers.forEach((watcher) => {
        newValue = watcher.watchFn(this);
        oldValue = watcher.last;
        if (newValue !== oldValue) {
            watcher.last = newValue;
            watcher.listenerFn(newValue,
                (oldValue === initWatchVal ? newValue : oldValue),
                this);
            dirty = true;
        }
    })
    return dirty;
}

export default Scope;
