import Scope from "../src/scope";

describe('Scope', () => {
    it('can be constructed and used as an object', function() {
        const scope = new Scope();
        scope.aProperty = 1;
        expect(scope.aProperty).to.equals(1);
    });

    it('calls the listener function when the watched value changes', function () {
        const scope = new Scope();
        scope.someValue = 'a';
        scope.counter = 0;
        scope.$watch(
            function(scope) { return scope.someValue; },
            function(newValue, oldValue, scope) {
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

    it('calls listener when watch value is first undefined', function() {
        const scope = new Scope();
        scope.counter = 0;
        scope.$watch(
            function(scope) { return scope.someValue; },
            function(newValue, oldValue, scope) { scope.counter++; }
        );
        scope.$digest();
        expect(scope.counter).to.equals(1);
    });
})
