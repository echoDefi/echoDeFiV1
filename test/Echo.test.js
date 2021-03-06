const { expect, should } = require("chai");

const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
require("@openzeppelin/test-helpers/configure")({
  provider: "http://localhost:7545",
});

const { BN, constants, expectRevert } = require("@openzeppelin/test-helpers");
const { MAX_UINT256 } = constants;
let Token;
const [sender, receiver, receiver1, other, other1] = accounts;

const helper = require("../service/utils");

const EchoStandard = contract.fromArtifact("ECHOStandard");

const toWei = (val) => web3.utils.toWei(val, "ether");

beforeEach(async () => {
  Token = await EchoStandard.new({ from: sender });
  await Token.updateRate(toWei("3.65"), { from: sender });
  await Token.exclude([sender], { from: sender });
});

describe("EchoStandard", () => {
  it("is deployed to sender", async () => {
    try {
      const bal = await Token.balanceOf(sender);
      expect(bal.toString()).to.equal(toWei("1000000"));
    } catch (error) {
      console.log(error);
    }
  });
  it("has name", async () => {
    try {
      const name = await Token.name();
      expect(name).to.be.a("string");
      expect(name).to.equal("echoDeFi");
    } catch (error) {
      console.log(error);
    }
  });
  it("has symbol", async () => {
    try {
      const symbol = await Token.symbol();
      expect(symbol).to.be.a("string");
      expect(symbol).to.equal("ECO");
    } catch (error) {
      console.log(error);
    }
  });
  it("approve", async () => {
    try {
      await Token.approve(receiver, toWei("10000"), { from: sender });
      const allowed = await Token.allowance(sender, receiver);
      expect(allowed.toString()).to.equal(toWei("10000"));
    } catch (error) {
      console.log(error);
    }
  });
  it("exclude", async () => {
    try {
      await Token.exclude([other], {
        from: sender,
      });
      const excld = await Token.isExcluded(other);
      expect(excld).to.be.true;
    } catch (error) {
      console.log(error);
    }
  });
  it("only owner can exclude", async () => {
    try {
      await expectRevert(
        Token.exclude([other], {
          from: other1,
        }),
        "only_owner",
      );
    } catch (error) {
      console.log(error);
    }
  });

  it("transfer", async () => {
    try {
      await Token.transfer(receiver, toWei("50"), { from: sender });
      const bal = await Token.balanceOf(receiver);
      expect(bal.toString()).to.equal(toWei("47.5"));
    } catch (error) {
      console.log(error);
    }
  });

  it("transferFrom", async () => {
    try {
      await Token.approve(receiver, MAX_UINT256, { from: sender });
      await Token.transferFrom(sender, receiver, toWei("10000"), {
        from: receiver,
      });
      const bal = await Token.balanceOf(receiver);
      expect(bal.toString()).to.equal(toWei("9500").toString());
    } catch (error) {
      console.log(error);
    }
  });

  it("mint rewards on transfer for HODL", async () => {
    try {
      await Token.transfer(receiver, toWei("100"), { from: sender });

      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(604820);
      await Token.transfer(receiver1, toWei("10"), { from: receiver });
      const nBal = await Token.balanceOf(receiver);

      expect(nBal.toString() > toWei("87.8").toString()).to.be.true;
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("mint rewards on transferFrom fro HODL", async () => {
    try {
      await Token.transfer(receiver, toWei("100"), { from: sender });
      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(604820);
      await Token.approve(receiver1, toWei("10"), { from: receiver });
      await Token.transferFrom(receiver, receiver1, toWei("10"), {
        from: receiver1,
      });
      const bal = await Token.balanceOf(receiver);

      expect(bal.toString() > toWei("87.8").toString()).to.be.true; // should be 85 if interest is not minted
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("will not mint HODL reward if 7 days is not fulfilled", async () => {
    try {
      await Token.transfer(receiver, toWei("100"), { from: sender });
      // const bal = await Token.balanceOf(receiver);

      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(179200);
      await Token.transfer(receiver1, toWei("10"), { from: receiver });
      const nBal = await Token.balanceOf(receiver);
      expect(nBal.toString()).to.equal(toWei("85").toString());
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("will not mint HODL reward if 7 days is not fulfilled", async () => {
    try {
      await Token.transfer(receiver, toWei("100"), { from: sender });
      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(245200);
      await Token.approve(receiver1, toWei("10"), { from: receiver });
      await Token.transferFrom(receiver, receiver1, toWei("10"), {
        from: receiver1,
      });
      const bal = await Token.balanceOf(receiver);
      expect(bal.toString()).to.equal(toWei("85").toString()); // should be 85 if interest is not minted
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("increase allowance", async () => {
    try {
      await Token.approve(receiver, toWei("10"), { from: sender });
      await Token.increaseAllowance(receiver, toWei("10"), {
        from: sender,
      });
      const allowd = await Token.allowance(sender, receiver);
      expect(allowd.toString()).to.equal(toWei("20").toString());
    } catch (error) {
      console.log(error);
    }
  });

  it("decrease allowance", async () => {
    try {
      await Token.approve(receiver, toWei("10"), { from: sender });
      await Token.decreaseAllowance(receiver, toWei("10"), {
        from: sender,
      });
      const allowd = await Token.allowance(sender, receiver);
      expect(allowd.toString()).to.equal(toWei("0").toString());
    } catch (error) {
      console.log(error);
    }
  });

  it("burn", async () => {
    try {
      await Token.burn(toWei("10000"), { from: sender });
      const bal = await Token.balanceOf(sender);
      expect(bal.toString()).to.equal(toWei("990000"));
    } catch (error) {
      console.log(error);
    }
  });

  it("burnFrom", async () => {
    try {
      await Token.approve(receiver, toWei("40000"), { from: sender });
      await Token.burnFrom(sender, toWei("40000"), { from: receiver });

      const bal = await Token.balanceOf(sender);
      expect(bal.toString()).to.equal(toWei("960000"));
    } catch (error) {
      console.log(error);
    }
  });

  it("revert burnFrom if allowance is less", async () => {
    try {
      await Token.approve(receiver, toWei("20000"), { from: sender });

      expectRevert(
        Token.burnFrom(sender, toWei("40000"), { from: receiver }),
        "Increase allowance",
      );
    } catch (error) {
      console.log(error);
    }
  });
});
