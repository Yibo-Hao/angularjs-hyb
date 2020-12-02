import _ from 'lodash';

import Scope from '../src/scope';

describe('Scope', () => {

    it('can be constructed and used as an object', function () {
        const scope = new Scope();
        scope.aProperty = 1;
        expect(scope.aProperty).to.equals(1);
    });

    it('calls the listener function when the watched value changes', function () {
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
        const scope = new Scope();
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
