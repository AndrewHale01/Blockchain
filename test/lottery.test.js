const Lottery = artifacts.require("Lottery");

contract("Lottery", (accounts) => {
  const entryFee = web3.utils.toWei("0.01", "ether");

  it("allows one entry per address at the exact ticket price", async () => {
    const lottery = await Lottery.new({ from: accounts[0] });

    await lottery.enter({ from: accounts[1], value: entryFee });

    const players = await lottery.getPlayers();
    assert.deepEqual(players, [accounts[1]]);
    assert.equal(await web3.eth.getBalance(lottery.address), entryFee);
    assert.equal(await lottery.hasEntered(accounts[1]), true);

    try {
      await lottery.enter({ from: accounts[1], value: entryFee });
      assert.fail("A player must not enter the same round twice");
    } catch (error) {
      assert.include(error.message, "Already entered this round");
    }
  });

  it("rejects incorrect ticket prices and unauthorized winner selection", async () => {
    const lottery = await Lottery.new({ from: accounts[0] });

    try {
      await lottery.enter({ from: accounts[1], value: 1 });
      assert.fail("An incorrect ticket price must be rejected");
    } catch (error) {
      assert.include(error.message, "Entry fee must be exactly 0.01 ETH");
    }

    await lottery.enter({ from: accounts[1], value: entryFee });
    try {
      await lottery.pickWinner({ from: accounts[1] });
      assert.fail("Only the manager may select the winner");
    } catch (error) {
      assert.include(error.message, "Only the manager can pick a winner");
    }
  });

  it("pays the winner, clears the players, and starts a new round", async () => {
    const lottery = await Lottery.new({ from: accounts[0] });
    await lottery.enter({ from: accounts[1], value: entryFee });

    await lottery.pickWinner({ from: accounts[0] });

    assert.equal(await lottery.lastWinner(), accounts[1]);
    assert.equal((await lottery.currentRound()).toString(), "2");
    assert.deepEqual(await lottery.getPlayers(), []);
    assert.equal(await lottery.hasEntered(accounts[1]), false);
    assert.equal(await web3.eth.getBalance(lottery.address), "0");
  });
});
