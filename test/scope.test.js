import _ from 'lodash';

import Scope from '../src/scope';

describe('Scope', () => {

    let scope;

    beforeEach(() => {
        scope = new Scope();
    });

    it('can be constructed and used as an object', function () {
        scope.aProperty = 1;
        expect(scope.aProperty).to.equals(1);
    });

    it('calls the listener function when the watched value changes', function () {
        scope.someValue = 'a';
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.someValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter += 1;
            }
        );
        expect(scope.counter).to.equals(0);
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.someValue = 'b';
        expect(scope.counter).to.equals(1);
        scope.$digest();
        expect(scope.counter).to.equals(2);
    });

    it('calls listener when watch value is first undefined', function () {
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.someValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
    });

    it('calls listener with new value as old value the first time', function () {
        scope.someValue = 123;
        let oldGiven = undefined;

        scope.$watch(
            function (scope) {
                return scope.someValue
            },
            function (newValue, oldValue) {
                oldGiven = oldValue
            }
        );
        scope.$digest();
        expect(oldGiven).to.equals(123);
    });

    it('triggers chained watchers in the same digest', function () {
        scope.name = 'Jane';
        scope.$watch(
            function (scope) {
                return scope.nameUpper;
            },
            function (newValue, oldValue, scope) {
                if (newValue) {
                    scope.initial = newValue.substring(0, 1) + '.';
                }
            })
        scope.$watch(
            function (scope) {
                return scope.name;
            },
            function (newValue, oldValue, scope) {
                if (newValue) {
                    scope.nameUpper = newValue.toUpperCase();
                }
            }
        );
        scope.$digest();
        expect(scope.initial).to.equals('J.');
        scope.name = 'Bob';
        scope.$digest();
        expect(scope.initial).to.equals('B.');
    });

    it('gives up on the watches after 10 iterations', function () {
        scope.counterA = 0;
        scope.counterB = 0;

        scope.$watch(
            function (scope) {
                return scope.counterA
            },
            function (newValue, oldValue, scope) {
                scope.counterB++;
            }
        )

        scope.$watch(
            function (scope) {
                return scope.counterB
            },
            function (newValue, oldValue, scope) {
                scope.counterA++;
            }
        )

        expect((function () {
            scope.$digest();
        })).to.throw();
    });

    it('ends the digest when the last watch is clean', function () {
        scope.array = _.range(100);
        let watchExecutions = 0;

        _.times(100, function (i) {
            scope.$watch(
                function (scope) {
                    watchExecutions++;
                    return scope.array[i];
                }
            );
        });

        scope.$digest();
        expect(watchExecutions).to.equals(200);
        scope.array[0] = 420;
        scope.$digest();
        expect(watchExecutions).to.equals(301);
    })

    it('compares based on value if enabled', function () {
        scope.aValue = [1, 2, 3];
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            },
            true
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.aValue.push(4);
        scope.$digest();
        expect(scope.counter).to.equals(2);
    });

    it('correctly handles NaNs', function () {
        scope.number = 0 / 0; // NaN
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.number;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.$digest();
        expect(scope.counter).to.equals(1);
    });

    it('catches exceptions in watch functions and continues', function () {
        scope.aValue = 'abc';
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                throw 'Error';
            },
            function (newValue, oldValue, scope) {
            }
        );
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
    });

    it('catches exceptions in listener functions and continues', function () {
        scope.aValue = 'abc';
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                throw 'Error';
            }
        );
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
    })

    it('allows destroying a $watch with a removal function', function () {
        scope.aValue = 'abc';
        scope.counter = 0;
        const destroyWatch = scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.aValue = 'def';
        scope.$digest();
        expect(scope.counter).to.equals(2);
        scope.aValue = 'ghi';
        destroyWatch();
        scope.$digest();
        expect(scope.counter).to.equals(2);
    });

    it('allows destroying a $watch during digest', function () {
        scope.aValue = 'abc';
        const watchCalls = [];
        scope.$watch(
            function (scope) {
                watchCalls.push('first');
                return scope.aValue;
            }
        );
        const destroyWatch = scope.$watch(
            function (scope) {
                watchCalls.push('second');
                destroyWatch();
            }
        );
        scope.$watch(
            function (scope) {
                watchCalls.push('third');
                return scope.aValue;
            }
        );
        scope.$digest();
        expect(watchCalls).to.deep.equals(['first', 'second', 'third', 'first', 'third']);
    });

    it('allows a $watch to destroy another during digest', function () {
        scope.aValue = 'abc';
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                destroyWatch();
            }
        );
        const destroyWatch = scope.$watch(
            function (scope) {
            },
            function (newValue, oldValue, scope) {
            }
        );
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
    });

    it('allows destroying several $watches during digest', function () {
        scope.aValue = 'abc';
        scope.counter = 0;
        const destroyWatch1 = scope.$watch(
            function (scope) {
                destroyWatch1();
                destroyWatch2();
            }
        );
        const destroyWatch2 = scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(0);
    });
})

describe('$eval', () => {

    let scope;

    beforeEach(() => {
        scope = new Scope();
    })

    it('executes $eval function and returns result', function () {
        scope.aValue = 42;
        const result = scope.$eval(function (scope) {
            return scope.aValue;
        });
        expect(result).to.equals(42);
    });

    it('passes the second $eval argument straight through', function () {
        scope.aValue = 42;
        const result = scope.$eval(function (scope, arg) {
            return scope.aValue + arg;
        }, 2);
        expect(result).to.equals(44);
    });
})

describe('$apply', () => {

    let scope;

    beforeEach(() => {
        scope = new Scope();
    })

    it('executes the given function and starts the digest', function () {
        scope.aValue = 'someValue';
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.$apply(function (scope) {
            scope.aValue = 'someOtherValue';
        });
        expect(scope.counter).to.equals(2);
    });

})

describe('$evalAsync', () => {

    let scope;

    beforeEach(function () {
        scope = new Scope();
    });

    it('executes given function later in the same cycle', function () {
        scope.aValue = [1, 2, 3];
        scope.asyncEvaluated = false;
        scope.asyncEvaluatedImmediately = false;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.$evalAsync(function (scope) {
                    scope.asyncEvaluated = true;
                });
                scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
            }
        );
        scope.$digest();
        expect(scope.asyncEvaluated).to.equals(true);
        expect(scope.asyncEvaluatedImmediately).to.equals(false);
    });

    it('executes $evalAsynced functions even when not dirty', function () {
        scope.aValue = [1, 2, 3];
        scope.asyncEvaluatedTimes = 0;
        scope.$watch(
            function (scope) {
                if (scope.asyncEvaluatedTimes < 2) {
                    scope.$evalAsync(function (scope) {
                        scope.asyncEvaluatedTimes++;
                    });
                }
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
            }
        );
        scope.$digest();
        expect(scope.asyncEvaluatedTimes).to.equals(2);
    });

    it('eventually halts $evalAsyncs added by watches', function () {
        scope.aValue = [1, 2, 3];
        scope.$watch(
            function (scope) {
                scope.$evalAsync(function (scope) {
                });
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
            }
        );
        expect(function () {
            scope.$digest();
        }).to.throw();
    });

    it('has a $$phase field whose value is the current digest phase', function () {
        scope.aValue = [1, 2, 3];
        scope.phaseInWatchFunction = undefined;
        scope.phaseInListenerFunction = undefined;
        scope.phaseInApplyFunction = undefined;
        scope.$watch(
            function (scope) {
                scope.phaseInWatchFunction = scope.$$phase;
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.phaseInListenerFunction = scope.$$phase;
            }
        );
        scope.$apply(function (scope) {
            scope.phaseInApplyFunction = scope.$$phase;
        });
        expect(scope.phaseInWatchFunction).to.equals('$digest');
        expect(scope.phaseInListenerFunction).to.equals('$digest');
        expect(scope.phaseInApplyFunction).to.equals('$apply');
    });

    it('schedules a digest in $evalAsync', function (done) {
        scope.aValue = 'abc';
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$evalAsync(function (scope) {
        });
        expect(scope.counter).to.equals(0);
        setTimeout(function () {
            expect(scope.counter).to.equals(1);
            done();
        }, 50);
    });
})

describe('$applyAsync', () => {
    let scope;

    beforeEach(function () {
        scope = new Scope();
    });

    it('allows async $apply with $applyAsync', function (done) {
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.$applyAsync(function (scope) {
            scope.aValue = 'abc';
        });
        expect(scope.counter).to.equals(1);
        setTimeout(function () {
            expect(scope.counter).to.equals(2);
            done();
        }, 50);
    });

    it('never executes $applyAsynced function in the same cycle', function (done) {
        scope.aValue = [1, 2, 3];
        scope.asyncApplied = false;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.$applyAsync(function (scope) {
                    scope.asyncApplied = true;
                });
            }
        );
        scope.$digest();
        expect(scope.asyncApplied).to.equals(false);
        setTimeout(function () {
            expect(scope.asyncApplied).to.equals(true);
            done();
        }, 50);
    });

    it('cancels and flushes $applyAsync if digested first', function (done) {
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                scope.counter++;
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
            }
        );
        scope.$applyAsync(function (scope) {
            scope.aValue = 'abc';
        });
        scope.$applyAsync(function (scope) {
            scope.aValue = 'def';
        });
        scope.$digest();
        expect(scope.counter).to.equals(2);
        expect(scope.aValue).to.equals('def');
        setTimeout(function () {
            expect(scope.counter).to.equals(2);
            done();
        }, 50);
    });
});

describe('$postDigest', () => {
    let scope;

    beforeEach(function () {
        scope = new Scope();
    });

    it('runs after each digest', function () {
        scope.counter = 0;
        scope.$$postDigest(function () {
            scope.counter++;
        });
        expect(scope.counter).to.equals(0);
        scope.$digest();
        expect(scope.counter).to.equals(1);
        scope.$digest();
        expect(scope.counter).to.equals(1);
    });

    it('does not include $$postDigest in the digest', function () {
        scope.aValue = 'original value';
        scope.$$postDigest(function () {
            scope.aValue = 'changed value';
        });
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.watchedValue = newValue;
            }
        );
        scope.$digest();
        expect(scope.watchedValue).to.equals('original value');
        scope.$digest();
        expect(scope.watchedValue).to.equals('changed value');
    });
});

describe('exceptions handle', () => {
    let scope;

    beforeEach(function () {
        scope = new Scope();
    });

    it('should handle exceptions in $evalAsync', function (done) {
        scope.aValue = 1;
        scope.counter = 0;
        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue, oldValue, scope) {
                scope.counter++;
            }
        )
        scope.$evalAsync(function () {
            throw ('error');
        })

        setTimeout(function () {
            expect(scope.counter).to.equals(1);
            done();
        }, 50);
    });

    it('should handle exceptions in $applyAsync', function (done) {
        scope.aValue = 0;
        scope.$applyAsync(function () {
            throw ('error');
        });
        scope.$applyAsync(function () {
            scope.aValue = 1;
        });
        setTimeout(function () {
            expect(scope.aValue).to.equals(1);
            done();
        }, 50);
    });

    it('should handle exceptions in $$postDigest', function () {
        let aValue = 0;
        scope.$$postDigest(function () {
            throw ('error');
        })
        scope.$$postDigest(function () {
            aValue = 1;
        })
        scope.$digest();

        expect(aValue).to.equals(1);
    });
});

describe('$watchGroup', () => {
    let scope;

    beforeEach(function () {
        scope = new Scope();
    });

    it('take watches as an array and calls listener with arrays ', function () {
        let gotNewValues, gotOldValues;
        scope.aValue = 1;
        scope.anotherValue = 2;
        scope.$watchGroup([
            function (scope) {
                return scope.aValue;
            },
            function (scope) {
                return scope.anotherValue
            }
        ], function (newValues, oldValues, scope) {
            gotNewValues = newValues;
            gotOldValues = oldValues;
        });
        scope.$digest();
        expect(gotNewValues).to.deep.equals([1, 2]);
        expect(gotOldValues).to.deep.equals([1, 2]);
    });

    it('only calls listener once per digest', function() {
        let counter = 0;
        scope.aValue = 1;
        scope.anotherValue = 2;
        debugger
        scope.$watchGroup([
            function(scope) { return scope.aValue; },
            function(scope) { return scope.anotherValue; }
        ], function(newValues, oldValues, scope) {
            counter++;
        });
        scope.$digest();
        expect(counter).to.equals(1);
    });

    it('use different arrays for old and new values on subsequent runs', function () {
        let gotNewValues, gotOldValues;
        scope.aValue = 1;
        scope.anotherValue = 2;
        scope.$watchGroup([
            function (scope) {
                return scope.aValue;
            },
            function (scope) {
                return scope.anotherValue
            }
        ], function (newValues, oldValues, scope) {
            gotNewValues = newValues;
            gotOldValues = oldValues;
        });
        scope.$digest();
        expect(gotNewValues).to.deep.equals([1, 2]);
        expect(gotOldValues).to.deep.equals([1, 2]);
        scope.aValue = 2;
        scope.$digest();
        expect(gotNewValues).to.deep.equals([2, 2]);
        expect(gotOldValues).to.deep.equals([1, 2]);
    });

    it('call listener once when watch array emety', function () {
        let counter = 0;
        scope.$watchGroup([], function (newValues, oldValues, scope) {
            counter++;
        });
        scope.$digest();
        expect(counter).to.equals(1);
        scope.$digest();
        expect(counter).to.equals(1);
    });

    it('watchGroup can be deregistered', function () {
        let counter = 0;
        scope.aValue = 1;
        scope.anotherValue = 2;
        const destroyGroup = scope.$watchGroup([
            function (scope) {
                return scope.aValue;
            },
            function (scope) {
                return scope.anotherValue
            }
        ], function (newValues, oldValues, scope) {
            counter++;
        });
        scope.$digest();
        scope.anotherValue = 3;
        destroyGroup();
        scope.$digest();
        expect(counter).to.equals(1);
    });

    it('does not call the zero-watch listener when deregistered first', function() {
        let counter = 0;
        const destroyGroup = scope.$watchGroup([], function(newValues, oldValues, scope) {
            counter++;
        });
        destroyGroup();
        scope.$digest();
        expect(counter).to.equals(0);
    });
});
