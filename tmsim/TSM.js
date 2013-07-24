
function TSM(){
	var self=this;
	var start_state;
	var current_state;
	var list_of_states;
	//state has two characteristics:
	/** 
		name:
		transition:
			current symbol:
				[new_state, write, move]
	**/

	var mTape=new TapeList();

	this.setup=function(states, startState, tape, tapeIndex){
		console.log(states);
		mTape.init(tape, tapeIndex);
		list_of_states=states;
		if(startState)
			start_state=list_of_states[startState];
		else {
		//if no start state is defined, then we take the first state that was instantiated
			start_state=list_of_states[Object.keys(list_of_states)[0]];
			console.log(Object.keys(list_of_states)[0]);
		}
		current_state = start_state;
		return self;
	}
	this.replaceTape = function(tape){
		mTape = tape;
		console.log('attaching new tape');
	}
	this.editTape = function(tape, tapeIndex){
		mTape.init(tape, tapeIndex);
	}
	this.start=function(tape){
		// console.log('beginning turing machine');
		if(tape){
			self.replaceTape(tape);
		}
		var new_state=start_state;
		var valid = true;
		var stepCount=0;
		while(valid){
			new_state=this.step(new_state);
			if(!new_state)
				valid=false;
			if(stepCount>5000000){
				throw 'too many steps in the turing machine'
			}
			stepCount++;
		}
		 console.log('ended turing machine with '+stepCount+' steps');
		return mTape;
	}
	this.step=function(new_state, tape){
		var stepTape = tape || mTape;
		var tapeRead=mTape.peek();
		var state_transition=new_state.transition[tapeRead];
		current_state = new_state;
		new_state=list_of_states[state_transition.new_state];
		stepTape.traverse(state_transition.write, state_transition.move);
		// console.log(new_state);
		if(state_transition.new_state === '*halt*'){
			valid=false;
			// mTape.printLL();
			// console.log('halting the sm');
			return false;
		} else if (state_transition.new_state === '*error*'){
			valid=false;
			mTape.printLL();
			console.log('encountered an error');
			return false;
		}

		return new_state;
	}
	this.getCurrentState = function(){
		return current_state;
	}
	return this;
}

