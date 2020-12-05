import _ from 'lodash';

function Scope() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
    this.$$postDigestQueue = [];
    this.$$phase = null;
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

    if (this.$$applyAsyncId) {
        clearTimeout(this.$$applyAsyncId);
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
        this.$digest();
    }
};

Scope.prototype.$evalAsync = function (expr) {
    const self = this;
    if (!self.$$phase && !self.$$asyncQueue.length) {
        setTimeout(function () {
            if (self.$$asyncQueue.length) {
                self.$digest();
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
    if (self.$$applyAsyncId === null) {
        self.$$applyAsyncId = setTimeout(function () {
            self.$apply(self.$$flushApplyAsync.bind(self));
        }, 0);
    }
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

Scope.prototype.$$flushApplyAsync = function () {
    while (this.$$applyAsyncQueue.length) {
        try {
            this.$$applyAsyncQueue.shift()();
        }catch (e) {
            console.log(e);
        }
    }
    this.$$applyAsyncId = null;
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

export default Scope;
