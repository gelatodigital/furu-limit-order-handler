# Gelato Limit Order with Furucombo Proxy

## Setup

1. Install dependencies

```
yarn
```

2. Compile

```
yarn compile
```

3. Run tests

```
yarn test
```

## Contract Dependencies

[**Gelato**](https://etherscan.io/address/0x3CACa7b48D0573D793d3b0279b5F0029180E83b6) 

Executor Entry point and handles fee logic (makes sure executors dont overcharge users)

[**GelatoPineCore**](https://etherscan.io/address/0x36049D479A97CdE1fC6E2a5D2caE30B666Ebf92B) 

Limit Order Servie Implementation: Stores ETH for ETH orders and does the encoding and decoding of orders

[**LimitOrderModule**](https://etherscan.io/address/0x037fc8e71445910e1E0bBb2a0896d5e9A7485318)

Module that handles logic that makes sure if a user wants to receive e.g. 10000 DAI for 1 ETH that they will always receive at least 10000 DAI from the trade

[**UniswapAction**](https://etherscan.io/address/0x842A8Dea50478814e2bFAFF9E5A27DC0D1FdD37c)

Conducts the swap on Uniswap v2


