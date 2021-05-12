// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface IProxy {
    /**
     * @notice Combo execution function. Including three phases: pre-process,
     * exection and post-process.
     * @param tos The handlers of combo.
     * @param configs The configurations of executing cubes.
     * @param datas The combo datas.
     */
    function batchExec(
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] calldata datas
    ) external payable;
}
