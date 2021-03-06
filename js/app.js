'use strict';

// App definition + dependencies
var myApp = angular.module('myApp', [
    // necessary for matching the URL to an available resource
    'ngRoute',
    // Material Design by Google
    'ngMaterial'
    ]);

// Route definition
myApp.config(['$routeProvider',
    function ($routeProvider) {
        $routeProvider
            // Homepage includes Expunge D.C. overview and link to the wizard
            .when('/', {
                templateUrl: 'views/home.html',
                controller: 'homeController'
            })
            // The wizard!
            .when('/eligibility-check', {
                redirectTo: function(routeParams, path, search) {
                    return '/eligibility-check/q/0'
                }
            })
            .when('/eligibility-check/q/:stateName', {
                templateUrl: 'views/eligibility-checker.html',
                controller: 'EligibilityWizardController as eligibilityCtrl'
            })
            // FAQs
            .when('/questions', {
                templateUrl: 'views/questions.html',
                controller: 'questionsController'
            })
            // Legal Aid Page
            .when('/legal-aid', {
                templateUrl: 'views/legal-aid.html',
                controller: 'legalAidController'
            })
            // If the user attempts to visit a route that doesn't match any of the patterns above, re-direct them to the homepage
            .otherwise({
                redirectTo: '/'
            });
}]);


// Homepage controller
myApp.controller('homeController',
    ['$scope',
        function ($scope) {


        }
]);

// FAQs controller
myApp.controller('questionsController',
    ['$scope',
        function ($scope) {


        }
]);

// Legal Aid controller
myApp.controller('legalAidController',
    ['$scope',
        function ($scope) {


        }
]);

//Keep userInput outside controller scope so that it isn't reset when $location changes
var userInput = [];
// questions in the order they were answered
// used to check if userInput needs to be cleaned up because user used the back button
var answeredQuestions = [];
// refactored version of Eligibility Checker Controller --AKA The Wizard
myApp.controller('EligibilityWizardController', function($http, $routeParams, $location) {
    var self = this; // self is equivalent to $scope
    self.eligibilityKnown = false;

    // boolean indicating whether final state is known
    var executeController = function(data) {
        //Set self.eligibilityFlow to the data returned by the http request
        self.eligibilityFlow = data;
        //Get the URL q parameter (the question name) from $routeParams
        self.params = $routeParams;

        //Get the length of the eligibilityFlow object (this is only needed for progress bar estimation)
        self.eligibilityFlowLength = Object.keys(self.eligibilityFlow.questions).length;

        // stateName is the name of the endState object or question object
        // (note: self.currentState points to the actual object)
        var stateName = self.params.stateName;

        // determine if this is a question or end state
        // is this is an end state?
        if (stateName in self.eligibilityFlow.endStates) {
            self.eligibilityKnown = true;
            self.currentState = self.eligibilityFlow.endStates[stateName];
            self.userInput = userInput;
        } else if (stateName in self.eligibilityFlow.questions) {
            self.currentState = self.eligibilityFlow.questions[stateName];
        } else { // if this state name does match an endState or question name, default to start
            $location.path('/eligibility-check/q/' + self.eligibilityFlow.start);
            self.currentState = self.eligibilityFlow.questions[self.eligibilityFlow.start];
        }

        // Grab the ineligible misdemeanors from a static JSON file stored at the root of the project
        $http.get('ineligible-misdemeanors.json')
        .success(function(data, status, headers, config) {
            // if the app successfully gets misdemeanor data from the JSON file, assign it to self.ineligibleMisdemeanors for use in the wizard
            self.ineligibleMisdemeanors = data;
        });

        // go back one question
        self.goBackOneQuestion = function() {
            // if user is on the first question, simulate hitting the browser back button
            if (self.stateName == self.eligibilityFlow.start) {
                window.history.back()
                return;
            }
            // if user is already on the results page and wants to go back
            if (self.eligibilityKnown)
                self.eligibilityKnown = false;
            // remove last entry from userInput and previous question
            userInput.pop();
            var previousQuestion = answeredQuestions.pop();
            // go back to the previous question
            $location.path('/eligibility-check/q/' + previousQuestion);
            self.currentState = self.eligibilityFlow.questions[previousQuestion];
        };

        self.restart = function() {
            // clear userInput and answeredQuestions
            userInput = [];
            answeredQuestions = [];
            // jump back to the start of this flow
            $location.path('/eligibility-check/q/' + self.eligibilityFlow.start);
            self.currentState = self.eligibilityFlow.questions[self.eligibilityFlow.start];
        };

        self.submitAnswer = function(answerIndex) {

            // if this question was already answered, cleanup userInput before adding this answer to history
            if (answeredQuestions.indexOf(stateName) > -1) {
                console.log("Could not find indexOf " + stateName + " so Cleaning up question/answer history.")
                var startDuplication = answeredQuestions.indexOf(stateName);
                userInput.splice(startDuplication, userInput.length - startDuplication);
                answeredQuestions.splice(startDuplication, answeredQuestions.length - startDuplication);
            }

            // record this question and answer in record and add to userInput
            var record = {};
            record.question = self.currentState.questionText;
            record.answer = self.currentState.answers[answerIndex].answerText;
            userInput.push(record);
            answeredQuestions.push(stateName);

            var next = self.currentState.answers[answerIndex].next;

            // check if this answer leads to an eligibility state
            if (next in self.eligibilityFlow.endStates) {
                self.eligibilityKnown = true;
                stateName = next;
                self.currentState = self.eligibilityFlow.endStates[next];
                self.userInput = userInput;
                return;
            }

            // update currentQuestion if eligibility still not known and next question is valid
            if (next in self.eligibilityFlow.questions) {
                stateName = next;
                self.currentState = self.eligibilityFlow.questions[next];
                return;
            }

            // else if there is no question corresponding to currentQuestion
            throw new Error("There is no question or endState \'" + next + "\' in self.eligibilityFlow.");

        };

        // progressBar calculation
        // TODO make this work even if the question names are not numbers
        self.progressBar = function() {
            var progressPercent = '';
            //If the current question isn't a number and is listed in the endStates array, then set the progess bar to 100
            if(isNaN(self.currentQuestion) && stateName in self.eligibilityFlow.endStates){
                progressPercent = 100;
            } else {
                //Otherwise, divide the current question number by the total number of question, multiply by 100, and round to get a nice percent
                progressPercent = Math.round((Number(stateName)/self.eligibilityFlowLength) * 100);
            }
            return progressPercent;
        };


    }


    $http.get('eligibility-flow.json')
    .success(function(data, status, headers, config) {
        // Get the eligibility-flow json blob
        executeController(data);
    });

});

// Partial
myApp.controller('titlebarController',
    ['$scope', '$mdSidenav',
        function ($scope, $mdSidenav) {
            $scope.openLeftMenu = function() {
                $mdSidenav('left').toggle();
            };

            $scope.close = function() {
              $mdSidenav('left').toggle();
            }

        }
]);