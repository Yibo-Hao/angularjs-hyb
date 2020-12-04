import _ from 'lodash';

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$phase = null;
}

function initWatchVal() {}

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
    const self = this;
    const watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function () {},
        valueEq: !!valueEq,
        last: initWatchVal
    };
    self.$$watchers.unshift(watcher);
    self.$$lastDirtyWatch = null;
    return function () {
        let index = self.$$watchers.indexOf(watcher);
        if (index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$digest = function () {
    let ttl = 10;
    let dirty;
    this.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');
    do {
        while (this.$$asyncQueue.length) {
            let asyncTask = this.$$asyncQueue.shift();
            asyncTask.scope.$eval(asyncTask.expression);
        }
        dirty = this.$$digestOnce();
        if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
            this.$clearPhase();
            throw ('10 digest iterations reached');
        }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();
}

Scope.prototype.$eval = function(expr, locals) {
    const self = this;

    return expr(self, locals);
};

Scope.prototype.$apply = function(expr) {
    try {
        this.$beginPhase('$apply');
        return this.$eval(expr);
    } finally {
        this.$clearPhase();
        this.$digest();
    }
};

Scope.prototype.$evalAsync = function(expr) {
    const self = this;
    if (!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function() {
            if (self.$$asyncQueue.length) {
                self.$digest();
            }
        }, 0);
    }
    self.$$asyncQueue.push({scope: self, expression: expr});
};


Scope.prototype.$beginPhase = function(phase) {
    if (this.$$phase) {
        throw this.$$phase + ' already in progress.';
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
    this.$$phase = null;
};

Scope.prototype.$$digestOnce = function () {
    const self = this;
    let newValue, oldValue, dirty;
    _.forEachRight(this.$$watchers, function (watcher) {
        try {
            if (watcher) {
                newValue = watcher.watchFn(self);
                oldValue = watcher.last;
                if (!self.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                    self.$$lastDirtyWatch = watcher;
                    watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                    watcher.listenerFn(newValue,
                        (oldValue === initWatchVal ? newValue : oldValue),
                        self);
                    dirty = true;
                } else if (self.$$lastDirtyWatch === watcher) {
                    return false;
                }
            }
        } catch (err) {
            console.log(err);
        }
    })
    return dirty;
}

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
    if (valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue ||
            (typeof newValue === 'number' && typeof oldValue === 'number' &&
                isNaN(newValue) && isNaN(oldValue));
    }
};

export default Scope;
