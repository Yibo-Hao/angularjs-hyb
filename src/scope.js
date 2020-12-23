import _ from 'lodash';

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
    this.$$postDigestQueue = [];
    this.$$phase = null;
    this.$root = this;
    this.$$children = [];
}

function initWatchVal() {
}

Scope.prototype.$watch = function (watchFn, listenerFn, valueEq) {
    const self = this;
    const watcher = {
        watchFn: watchFn,
        listenerFn: listenerFn || function () {
        },
        valueEq: !!valueEq,
        last: initWatchVal
    };
    self.$$watchers.unshift(watcher);
    self.$root.$$lastDirtyWatch = null;
    return function () {
        let index = self.$$watchers.indexOf(watcher);
        if (index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$root.$$lastDirtyWatch = null;
        }
    };
};

Scope.prototype.$digest = function () {
    let ttl = 10;
    let dirty;
    this.$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if (this.$root.$$applyAsyncId) {
        clearTimeout(this.$root.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do {
        while (this.$$asyncQueue.length) {
            try {
                let asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression);
            } catch (e) {
                console.log(e);
            }
        }
        dirty = this.$$digestOnce();
        if ((dirty || this.$$asyncQueue.length) && !(ttl--)) {
            this.$clearPhase();
            throw ('10 digest iterations reached');
        }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();

    while (this.$$postDigestQueue.length) {
        try {
            this.$$postDigestQueue.shift()();
        }catch (e) {
            console.log(e);
        }
    }
}

Scope.prototype.$eval = function (expr, locals) {
    const self = this;

    return expr(self, locals);
};

Scope.prototype.$apply = function (expr) {
    try {
        this.$beginPhase('$apply');
        return this.$eval(expr);
    } finally {
        this.$clearPhase();
        this.$root.$digest();
    }
};

Scope.prototype.$evalAsync = function (expr) {
    const self = this;
    if (!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function () {
            if (self.$$asyncQueue.length) {
                self.$root.$digest();
            }
        }, 0);
    }
    self.$$asyncQueue.push({scope: self, expression: expr});
};

Scope.prototype.$beginPhase = function (phase) {
    if (this.$$phase) {
        throw this.$$phase + ' already in progress.';
    }
    this.$$phase = phase;
};

Scope.prototype.$clearPhase = function () {
    this.$$phase = null;
};

Scope.prototype.$applyAsync = function (expr) {
    const self = this;

    self.$$applyAsyncQueue.push(function () {
        self.$eval(expr);
    });
    if (self.$root.$$applyAsyncId === null) {
        self.$root.$$applyAsyncId = setTimeout(function () {
            self.$apply(self.$$flushApplyAsync.bind(self));
        }, 0);
    }
};

Scope.prototype.$$digestOnce = function () {
    let dirty,
        continueLoop = true,
        self = this;

    self.$$everyScope(function (scope) {
        let newValue, oldValue
        _.forEachRight(scope.$$watchers, function (watcher) {
            try {
                if (watcher) {
                    newValue = watcher.watchFn(scope);
                    oldValue = watcher.last;
                    if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                        self.$root.$$lastDirtyWatch = watcher;
                        watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
                        watcher.listenerFn(newValue,
                            (oldValue === initWatchVal ? newValue : oldValue),
                            scope);
                        dirty = true;
                    } else if (self.$root.$$lastDirtyWatch === watcher) {
                        continueLoop = false;
                        return false;
                    }
                }
            } catch (err) {
                console.log(err);
            }
        })
        return continueLoop;
    })

    return dirty;
}

Scope.prototype.$$flushApplyAsync = function () {
    while (this.$$applyAsyncQueue.length) {
        try {
            this.$$applyAsyncQueue.shift()();
        }catch (e) {
            console.log(e);
        }
    }
    this.$root.$$applyAsyncId = null;
};

Scope.prototype.$$areEqual = function (newValue, oldValue, valueEq) {
    if (valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue ||
            (typeof newValue === 'number' && typeof oldValue === 'number' &&
                isNaN(newValue) && isNaN(oldValue));
    }
};

Scope.prototype.$$postDigest = function(fn) {
    this.$$postDigestQueue.push(fn);
};

Scope.prototype.$$everyScope = function(fn) {
    if (fn(this)) {
        return this.$$children.every(function(child) {
            return child.$$everyScope(fn);
        });
    } else {
        return false;
    }
};

Scope.prototype.$watchGroup = function(watchFns, listenerFn) {
    const self = this;
    const newValues = new Array(watchFns.length);
    const oldValues = new Array(watchFns.length);
    let changeReactionScheduled = false;
    let firstRun = true;

    if (watchFns.length === 0) {
        let shouldCall = true;
        self.$evalAsync(function() {
            if (shouldCall) {
                listenerFn(newValues, newValues, self);
            }
        });
        return function() {
            shouldCall = false;
        };
    }

    function watchGroupListener() {
        if (firstRun) {
            firstRun = false;
            listenerFn(newValues, newValues, self);
        } else {
            listenerFn(newValues, oldValues, self);
        }
        changeReactionScheduled = false;
    }

    let destroyFunctions = _.map(watchFns, function(watchFn, i) {
        return self.$watch(watchFn, function(newValue, oldValue) {
            newValues[i] = newValue;
            oldValues[i] = oldValue;
            if (!changeReactionScheduled) {
                changeReactionScheduled = true;
                self.$evalAsync(watchGroupListener);
            }
        });
    });

    return function() {
        _.forEach(destroyFunctions, function(destroyFunction) {
            destroyFunction();
        });
    };
};

Scope.prototype.$destroy = function() {
    if (this.$parent) {
        const siblings = this.$parent.$$children;
        const indexOfThis = siblings.indexOf(this);
        if (indexOfThis >= 0) {
            siblings.splice(indexOfThis, 1);
        }
    }
    this.$$watchers = null;
};

Scope.prototype.$new = function(isolated, parent) {
    let child;
    parent = parent || this;
    if (isolated) {
        child = new Scope();
        child.$root = this.$root;
        child.$$asyncQueue = this.$$asyncQueue;
        child.$$postDigestQueue = this.$$postDigestQueue;
        child.$$applyAsyncQueue = this.$$applyAsyncQueue;
    } else {
        const ChildScope = function() {};
        ChildScope.prototype = this;
        child = new ChildScope();
    }
    this.$$children.push(child);
    child.$$watchers = [];
    child.$$children = [];
    child.$parent = parent;
    return child;
};

Scope.prototype.$watchCollection = function (watchFn, listenerFn) {
    const self = this;
    let newValue,
        oldValue,
        changeCount = 0;

    const internalWatchFn = function (scope) {
        newValue = watchFn(scope);
        if (!self.$$areEqual(newValue, oldValue, false)) {
            changeCount++;
        }
        oldValue = newValue;
        return changeCount;
    };

    const internalListenerFn = function () {
        listenerFn(newValue, oldValue, self);
    };

    return this.$watch(internalWatchFn, internalListenerFn);
};

export default Scope;
