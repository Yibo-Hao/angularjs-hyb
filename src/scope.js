import _ from 'lodash';

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
}
function initWatchVal() {}

Scope.prototype.$watch = function (watchFn, listenerFn) {
    const watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function () {},
        last: initWatchVal
    };
    this.$$watchers.push(watcher);
    this.$$lastDirtyWatch = null;
};

Scope.prototype.$digest = function () {
    let ttl = 10;
    let dirty;
    this.$$lastDirtyWatch = null;
    do {
        dirty = this.$$digestOnce();
        if (dirty && !(ttl--)) {
            throw ('10 digest iterations reached');
        }
    } while (dirty);
}

Scope.prototype.$$digestOnce = function() {
    const self = this;
    let newValue, oldValue, dirty;
    _.forEach(this.$$watchers, function(watcher) {
        newValue = watcher.watchFn(self);
        oldValue = watcher.last;
        if (newValue !== oldValue) {
            self.$$lastDirtyWatch = watcher;
            watcher.last = newValue;
            watcher.listenerFn(newValue,
                (oldValue === initWatchVal ? newValue : oldValue),
                self);
            dirty = true;
        } else if (self.$$lastDirtyWatch === watcher) {
            return false;
        }
    })
    return dirty;
}

export default Scope;
