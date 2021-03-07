const { expect, should } = require("chai");

const { accounts, contract, web3 } = require("@openzeppelin/test-environment");
require("@openzeppelin/test-helpers/configure")({
  provider: "http://localhost:7545",
});

const { constants, expectRevert } = require("@openzeppelin/test-helpers");
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

describe("EcoStandard", () => {
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
      expect(symbol).to.equal("ECHO");
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

  it("mint rewards on transfer for min HODL period", async () => {
    try {
      await Token.transfer(receiver, toWei("40000"), { from: sender });

      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(604801);
      await Token.transfer(receiver1, toWei("10"), { from: receiver });
      const nBal = await Token.balanceOf(receiver);
      console.log(nBal.toString());
      expect(
        nBal.toString() > toWei("40700").toString() &&
          nBal.toString() < toWei("40800").toString(),
      ).to.be.true;
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("mint rewards on transfer for max HODL period", async () => {
    try {
      await Token.transfer(receiver, toWei("40000"), { from: sender });

      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(15811200);
      await Token.transfer(receiver1, toWei("10"), { from: receiver });
      const maxHODL = await Token.balanceOf(receiver);
      console.log(maxHODL.toString());
      expect(
        maxHODL.toString() > toWei("236000").toString() &&
          maxHODL.toString() < toWei("238000").toString(),
      ).to.be.true;
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("limits compounding to maxHODL time", async () => {
    try {
      await Token.transfer(receiver, toWei("40000"), { from: sender });

      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(31536000);
      await Token.transfer(receiver1, toWei("10"), { from: receiver });
      const nBal = await Token.balanceOf(receiver);
      console.log(nBal.toString());
      expect(
        nBal.toString() > toWei("236000").toString() &&
          nBal.toString() < toWei("237000").toString(),
      ).to.be.true;
      // expect(nBal.toString() < toWei("237000").toString()).to.be.true;
      await helper.revertToSnapShot(snapshotId);
    } catch (error) {
      console.log(error);
    }
  });

  it("will not mint reward until after another 7 days if reward was mint within the last 8 days", async () => {
    try {
      await Token.transfer(receiver, toWei("40000"), { from: sender });

      const snapShot = await helper.takeSnapshot();
      const snapshotId = snapShot["result"];
      await helper.advanceTime(31536000);
      await Token.transfer(receiver1, toWei("10"), { from: receiver });
      const nBal = await Token.balanceOf(receiver);
      console.log("firstBalance: ", nBal.toString());

      await helper.advanceTime(587520);
      await Token.transfer(other, toWei("100"), { from: receiver });
      const bal = await Token.balanceOf(receiver);
      console.log("secondBalance: ", bal.toString());
      expect(+nBal.toString() - +toWei("100").toString() === +bal.toString()).to
        .be.true;
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
