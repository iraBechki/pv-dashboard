import { useState } from 'react';
import './App.css';

function App() {
  // State: a number that starts at 0
  const [count, setCount] = useState(0);

  // Function to increase count
  const increment = () => {
    setCount(count + 1);
  };

  // Function to decrease count
  const decrement = () => {
    setCount(count - 1);
  };

  // Function to reset
  const reset = () => {
    setCount(0);
  };

  return (
    <div className="App">
      <h1>Simple Counter</h1>
      <div className="counter-display">
        <h2>{count}</h2>
      </div>
      <div className="buttons">
        <button onClick={decrement}>-</button>
        <button onClick={reset}>Reset</button>
        <button onClick={increment}>+</button>
      </div>
    </div>
  );
}

export default App;