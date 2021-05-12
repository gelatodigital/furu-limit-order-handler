// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.6.0;

interface IHFunds {
    function inject(address[] calldata tokens, uint256[] calldata amounts)
        external
        payable;
}
