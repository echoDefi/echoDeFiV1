// SPDX-License-Identifier: MIT;
pragma solidity ^0.6.10;

import "./ERC20Detailed.sol";
import "./libraries/DSMath.sol";
import "./libraries/SafeMath.sol";

contract ECHOStandard is ERC20Detailed, DSMath {
    using SafeMath for uint256;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowed;

    string constant tokenName = "echoDeFi";
    string constant tokenSymbol = "ECO";
    uint8 constant tokenDecimals = 18;
    uint256 _totalSupply = 1_000_000 ether;
    uint256 public rate;
    mapping(address => uint256) public lastTimeBalanceNegative;
    mapping(address => uint256) public lastTimeBalancePositive;
    mapping(address => bool) public hasTransfered;
    uint256 public minimumBalance = 50 ether;
    uint256 public maxRewardable = 40_000 ether;
    uint256 public HODLTimeRewardable = 7 days;
    uint8 public burnRate = 5;
    mapping(address => uint256) public balanceBeforeLastReceive;
    mapping(address => bool) public isExcluded;
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "only_owner");
        _;
    }

    constructor()
        public
        payable
        ERC20Detailed(tokenName, tokenSymbol, tokenDecimals)
    {
        _mint(msg.sender, _totalSupply);
        owner = msg.sender;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address _owner) public view override returns (uint256) {
        return _balances[_owner];
    }

    function allowance(address _owner, address spender)
        public
        view
        override
        returns (uint256)
    {
        return _allowed[_owner][spender];
    }

    function findBurnVol(uint256 value) public view returns (uint256) {
        uint256 roundValue = value.ceil(100);
        uint256 burnVol = roundValue.mul(burnRate).div(100);
        return burnVol;
    }

    function wadToRay(uint256 _wad) internal pure returns (uint256) {
        return mul(_wad, 10**9);
    }

    function weiToRay(uint256 _wei) internal pure returns (uint256) {
        return mul(_wei, 10**27);
    }

    function yearlyRateToRay(uint256 _rateWad) internal pure returns (uint256) {
        return
            add(
                wadToRay(1 ether),
                rdiv(wadToRay(_rateWad), weiToRay(365 * 86400))
            );
    }

    function updateRate(uint256 rateWad) external onlyOwner {
        rate = yearlyRateToRay(rateWad);
    }

    function viewAccruedPlusCapital(address user)
        external
        view
        returns (uint256)
    {
        uint256 time =
            !hasTransfered[user]
                ? block.timestamp.sub(lastTimeBalancePositive[user])
                : block.timestamp.sub(lastTimeBalanceNegative[user]);
        return accrueInterest(_balances[user], rate, time);
    }

    function accrueInterest(
        uint256 _principal,
        uint256 _rate,
        uint256 _age
    ) internal pure returns (uint256) {
        return rmul(_principal, rpow(_rate, _age));
    }

    function calculateEarned(address user, uint256 balance)
        internal
        view
        returns (uint256)
    {
        uint256 sinceLastReceived =
            block.timestamp.sub(lastTimeBalancePositive[user]);
        uint256 time =
            !hasTransfered[user]
                ? block.timestamp.sub(lastTimeBalancePositive[user])
                : block.timestamp.sub(lastTimeBalanceNegative[user]);
        uint256 bals =
            sinceLastReceived < HODLTimeRewardable
                ? balanceBeforeLastReceive[user]
                : balance;
        if (bals > minimumBalance) return accrueInterest(bals, rate, time);
    }

    function transfer(address to, uint256 value)
        public
        override
        returns (bool)
    {
        require(value <= _balances[msg.sender], "Insufficient");
        require(to != address(0), "Address_zero");
        uint256 balance_ = _balances[msg.sender];
        _balances[msg.sender] = _balances[msg.sender].sub(value);

        balanceBeforeLastReceive[to] = _balances[to];
        uint256 tokensToBurn = findBurnVol(value);
        uint256 tokensToTransfer = value.sub(tokensToBurn);

        _balances[to] = _balances[to].add(tokensToTransfer);

        _totalSupply = _totalSupply.sub(tokensToBurn);
        emit Transfer(msg.sender, address(0), tokensToBurn);
        emit Transfer(msg.sender, to, tokensToTransfer);

        reward(msg.sender, balance_);
        lastTimeBalancePositive[to] = block.timestamp;
        lastTimeBalanceNegative[msg.sender] = block.timestamp;
        hasTransfered[msg.sender] = true;
        return true;
    }

    function reward(address person, uint256 amount) internal {
        if (!isExcluded[person] && calculateEarned(person, amount) > 0) {
            uint256 _amount = amount > maxRewardable ? maxRewardable : amount;
            uint256 value = (calculateEarned(person, _amount)).sub(_amount);
            _mint(person, value);
            _totalSupply = _totalSupply.add(value);
        }
    }

    function multiTransfer(address[] memory receivers, uint256[] memory amounts)
        external
    {
        for (uint256 i = 0; i < receivers.length; i++) {
            transfer(receivers[i], amounts[i]);
        }
    }

    function approve(address spender, uint256 value)
        public
        override
        returns (bool)
    {
        require(spender != address(0), "Address_zero");
        _allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public override returns (bool) {
        require(value <= _balances[from], "Insufficient");
        require(value <= _allowed[from][msg.sender], "Increase_allowance");
        require(to != address(0), "Address_zero");
        uint256 balance_ = _balances[from];
        _balances[from] = _balances[from].sub(value);
        balanceBeforeLastReceive[to] = _balances[to];
        uint256 tokensToBurn = findBurnVol(value);
        uint256 tokensToTransfer = value.sub(tokensToBurn);

        _balances[to] = _balances[to].add(tokensToTransfer);
        _totalSupply = _totalSupply.sub(tokensToBurn);
        emit Transfer(from, to, tokensToTransfer);
        emit Transfer(from, address(0), tokensToBurn);
        reward(from, balance_);
        _allowed[from][msg.sender] = _allowed[from][msg.sender].sub(value);
        lastTimeBalancePositive[to] = block.timestamp;
        lastTimeBalanceNegative[from] = block.timestamp;
        hasTransfered[from] = true;
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue)
        external
        returns (bool)
    {
        require(spender != address(0), "Address zero");
        _allowed[msg.sender][spender] = (
            _allowed[msg.sender][spender].add(addedValue)
        );
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue)
        external
        returns (bool)
    {
        require(spender != address(0), "Address zero");
        _allowed[msg.sender][spender] = (
            _allowed[msg.sender][spender].sub(subtractedValue)
        );
        emit Approval(msg.sender, spender, _allowed[msg.sender][spender]);
        return true;
    }

    function _mint(address account, uint256 amount) internal {
        require(amount != 0, "Amount must be > 0");
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function _burn(address account, uint256 amount) internal {
        require(amount != 0, "Amount must be > 0");
        require(amount <= _balances[account], "Insufficient");
        _totalSupply = _totalSupply.sub(amount);
        _balances[account] = _balances[account].sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function burnFrom(address account, uint256 amount) external {
        require(amount <= _allowed[account][msg.sender], "Increase allowance");
        _allowed[account][msg.sender] = _allowed[account][msg.sender].sub(
            amount
        );
        _burn(account, amount);
    }

    /* Restricted functions */
    function updateBurnRate(uint8 bRate) external onlyOwner {
        burnRate = bRate;
    }

    function setRewardTimeHODLTime(uint256 _hodlTime) external onlyOwner {
        HODLTimeRewardable = _hodlTime;
    }

    function setMinMaxBalanceRewardable(uint256 _minR, uint256 _maxR)
        external
        onlyOwner
    {
        minimumBalance = _minR;
        maxRewardable = _maxR;
    }

    function transferOwnership(address _newOwner) external onlyOwner {
        owner = _newOwner;
    }

    function exclude(address[] calldata _excludes) external onlyOwner {
        for (uint8 i; i < _excludes.length; ++i) {
            isExcluded[_excludes[i]] = true;
        }
    }
}
