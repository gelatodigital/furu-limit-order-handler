// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IRegistry {
    function register(address registration, bytes32 info) external;

    function owner() external view returns (address);
}
